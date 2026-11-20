import { Group, Expense, Member } from '../types';
import { StorageService } from './StorageInterface';
import { LocalGroupStore } from './LocalGroupStore';
import { OperationQueue, QueuedOperation } from './OperationQueue';

function errorMessage(error: unknown): string {
    return String((error as any)?.message ?? error);
}

function isNotFound(error: unknown): boolean {
    return /not.?found|no document/i.test(errorMessage(error));
}

/**
 * Replays queued operations in order, one group at a time.
 *
 * Operations for the same group are processed FIFO so dependencies such as
 * createGroup -> addExpense are respected. If one operation fails, the rest
 * of that group's queue is kept for the next attempt; other groups continue.
 */
export class OperationProcessor {
    private readonly storage: StorageService;
    private running = false;
    private rerun = false;

    constructor(storage: StorageService) {
        this.storage = storage;
    }

    async processAll(): Promise<void> {
        if (this.running) {
            this.rerun = true;
            return;
        }

        this.running = true;

        try {
            do {
                this.rerun = false;
                await this.runOnce();
            } while (this.rerun && await OperationQueue.hasAny());
        } finally {
            this.running = false;
        }
    }

    private async runOnce(): Promise<void> {
        const operations = await OperationQueue.getAll();
        if (operations.length === 0) return;

        const byGroup = new Map<string, QueuedOperation[]>();
        for (const operation of operations) {
            const groupOperations = byGroup.get(operation.groupId);
            if (groupOperations) {
                groupOperations.push(operation);
            } else {
                byGroup.set(operation.groupId, [operation]);
            }
        }

        for (const [groupId, groupOperations] of byGroup) {
            for (const operation of groupOperations) {
                if (this.isBackedOff(operation)) {
                    // Retry later; keep FIFO order within the group.
                    break;
                }

                try {
                    await this.apply(operation);
                    await OperationQueue.remove(operation.id);
                } catch (error) {
                    console.error(
                        `[Operations] Failed to apply ${operation.type} for group ${groupId}:`,
                        error
                    );
                    await OperationQueue.markFailure(operation.id, error);
                    // Preserve FIFO ordering and retry this group on the next trigger.
                    break;
                }
            }
        }
    }

    /**
     * Exponential backoff so a permanently failing operation (for example,
     * permission denied) is not retried on every connectivity event.
     */
    private isBackedOff(operation: QueuedOperation): boolean {
        if (operation.attempts === 0 || !operation.lastAttemptAt) {
            return false;
        }

        const delay = Math.min(60_000, 1_000 * 2 ** Math.min(operation.attempts, 6));
        return Date.now() - operation.lastAttemptAt < delay;
    }

    private async apply(operation: QueuedOperation): Promise<void> {
        switch (operation.type) {
            case 'createGroup':
            case 'mergeGroup':
                await this.mergeLocalSnapshot(operation.groupId);
                return;

            case 'addExpense':
                try {
                    await this.storage.addExpense(operation.groupId, operation.payload as Expense);
                } catch (error) {
                    // The group was deleted remotely; there is nothing left to
                    // attach the expense to.
                    if (!isNotFound(error)) throw error;
                }
                return;

            case 'deleteExpense':
                try {
                    await this.storage.deleteExpense(operation.groupId, operation.payload.expenseId);
                } catch (error) {
                    if (!isNotFound(error)) throw error;
                }
                return;

            case 'addMember':
                try {
                    await this.storage.addMember(operation.groupId, operation.payload as Member);
                } catch (error) {
                    if (!isNotFound(error)) throw error;
                }
                return;

            case 'removeMember':
                try {
                    await this.storage.removeMember(operation.groupId, operation.payload.memberId);
                } catch (error) {
                    if (!isNotFound(error)) throw error;
                }
                return;

            case 'updateMemberStatus':
                try {
                    await this.storage.updateMemberStatus(
                        operation.groupId,
                        operation.payload.memberId,
                        operation.payload.status
                    );
                } catch (error) {
                    if (!isNotFound(error)) throw error;
                }
                return;

            case 'updateGroup':
                try {
                    await this.storage.updateGroup(operation.groupId, operation.payload as Partial<Group>);
                } catch (error) {
                    if (!isNotFound(error)) throw error;
                }
                return;

            case 'deleteGroup':
                try {
                    await this.storage.deleteGroup(operation.groupId);
                } catch (error) {
                    if (!isNotFound(error)) throw error;
                }
                return;

            default:
                throw new Error(`Unknown operation type: ${(operation as QueuedOperation).type}`);
        }
    }

    /**
     * Best-effort merge used by createGroup/mergeGroup and by the migration of
     * legacy dirty groups. Only adds local data and updates group fields; it
     * never deletes server members or expenses.
     */
    private async mergeLocalSnapshot(groupId: string): Promise<void> {
        const localGroup = await LocalGroupStore.getGroup(groupId);
        if (!localGroup) {
            // The group was deleted locally before this operation ran.
            return;
        }

        const owner = localGroup.members.find((member) => member.id === localGroup.ownerId);
        if (!owner) {
            throw new Error(`Group ${groupId} has no owner`);
        }

        let serverGroup = await this.storage.getGroup(groupId);

        if (!serverGroup) {
            await this.storage.createGroup(
                localGroup.name,
                { id: owner.id, name: owner.name, email: owner.email },
                localGroup.id
            );
            serverGroup = await this.storage.getGroup(groupId);
        }

        if (!serverGroup) {
            throw new Error(`Group ${groupId} is not available after creation`);
        }

        for (const member of localGroup.members) {
            const existsOnServer = serverGroup.members.some((serverMember) => serverMember.id === member.id);
            if (!existsOnServer) {
                await this.storage.addMember(groupId, member);
            }
        }

        for (const expense of localGroup.expenses) {
            const existsOnServer = serverGroup.expenses.some((serverExpense) => serverExpense.id === expense.id);
            if (!existsOnServer) {
                await this.storage.addExpense(groupId, expense);
            }
        }

        const updates: Partial<Group> = {};
        if (localGroup.name !== serverGroup.name) updates.name = localGroup.name;
        // Never publish a device-local file URI: other members cannot read it.
        if (
            localGroup.imageUrl &&
            !localGroup.imageUrl.startsWith('file://') &&
            localGroup.imageUrl !== serverGroup.imageUrl
        ) {
            updates.imageUrl = localGroup.imageUrl;
        }

        if (Object.keys(updates).length > 0) {
            await this.storage.updateGroup(groupId, updates);
        }

        // Migration cleanup: legacy dirty flags are no longer the source of truth.
        await LocalGroupStore.clearDirty(groupId);
    }
}
