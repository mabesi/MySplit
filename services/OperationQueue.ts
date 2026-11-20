import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Durable queue of Firestore mutations.
 *
 * Every offline-first mutation is written here first (optimistically applied
 * to LocalGroupStore), then replayed by OperationProcessor when online. This
 * replaces the old full-snapshot reconciliation, which could delete data
 * based on a stale local copy.
 */

const STORAGE_KEY = 'pending_group_operations';

export type OperationType =
    | 'createGroup'
    | 'mergeGroup'
    | 'addMember'
    | 'removeMember'
    | 'updateMemberStatus'
    | 'addExpense'
    | 'deleteExpense'
    | 'updateGroup'
    | 'deleteGroup';

export interface QueuedOperation {
    id: string;
    groupId: string;
    type: OperationType;
    // Payload shape depends on `type`; kept loose to avoid a large union here.
    payload: any;
    createdAt: number;
    attempts: number;
    lastAttemptAt?: number;
    lastError?: string;
}

export type NewOperation = Pick<QueuedOperation, 'id' | 'groupId' | 'type' | 'payload'> & {
    createdAt?: number;
};

const listeners = new Set<() => void>();

function emitChange() {
    listeners.forEach((listener) => {
        try {
            listener();
        } catch (error) {
            console.error('[OperationQueue] Listener error:', error);
        }
    });
}

// Serialize all queue mutations so concurrent enqueues cannot lose operations.
let queueLock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const result = queueLock.then(fn, fn);
    queueLock = result.then(
        () => undefined,
        () => undefined
    );
    return result;
}

async function readQueue(): Promise<QueuedOperation[]> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (!json) return [];
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('[OperationQueue] Failed to read queue:', error);
        return [];
    }
}

async function writeQueue(operations: QueuedOperation[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(operations));
    emitChange();
}

function sortByCreation(operations: QueuedOperation[]): QueuedOperation[] {
    return operations.slice().sort((a, b) => a.createdAt - b.createdAt);
}

export const OperationQueue = {
    subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    async getAll(): Promise<QueuedOperation[]> {
        return sortByCreation(await readQueue());
    },

    async count(): Promise<number> {
        return (await readQueue()).length;
    },

    async hasAny(): Promise<boolean> {
        return (await readQueue()).length > 0;
    },

    async getForGroup(groupId: string): Promise<QueuedOperation[]> {
        const operations = await readQueue();
        return sortByCreation(operations.filter((op) => op.groupId === groupId));
    },

    async hasPendingForGroup(groupId: string): Promise<boolean> {
        return (await readQueue()).some((op) => op.groupId === groupId);
    },

    enqueue(operation: NewOperation): Promise<QueuedOperation> {
        return withLock(async () => {
            const operations = await readQueue();
            const existingIndex = operations.findIndex((op) => op.id === operation.id);
            const now = operation.createdAt ?? Date.now();

            if (existingIndex >= 0) {
                const existing = operations[existingIndex];

                // Field updates are coalesced; every other operation keeps its
                // latest payload but preserves its original position in the
                // queue so dependencies (e.g. createGroup before addExpense)
                // are not reordered.
                const payload = operation.type === 'updateGroup'
                    ? { ...existing.payload, ...operation.payload }
                    : operation.payload;

                const merged: QueuedOperation = {
                    ...existing,
                    ...operation,
                    payload,
                    createdAt: existing.createdAt,
                    attempts: 0,
                    lastAttemptAt: undefined,
                    lastError: undefined
                };

                operations[existingIndex] = merged;
                await writeQueue(operations);
                return merged;
            }

            const queued: QueuedOperation = {
                ...operation,
                createdAt: now,
                attempts: 0
            };

            operations.push(queued);
            await writeQueue(sortByCreation(operations));
            return queued;
        });
    },

    remove(operationId: string): Promise<void> {
        return withLock(async () => {
            const operations = await readQueue();
            await writeQueue(operations.filter((op) => op.id !== operationId));
        });
    },

    removeGroup(groupId: string): Promise<void> {
        return withLock(async () => {
            const operations = await readQueue();
            await writeQueue(operations.filter((op) => op.groupId !== groupId));
        });
    },

    markFailure(operationId: string, error: unknown): Promise<void> {
        return withLock(async () => {
            const operations = await readQueue();
            const index = operations.findIndex((op) => op.id === operationId);
            if (index < 0) return;

            const message = String((error as any)?.message ?? error).slice(0, 500);
            operations[index] = {
                ...operations[index],
                attempts: operations[index].attempts + 1,
                lastAttemptAt: Date.now(),
                lastError: message
            };

            await writeQueue(operations);
        });
    },

    async clear(): Promise<void> {
        await withLock(async () => writeQueue([]));
    }
};
