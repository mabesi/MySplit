import { Group, Expense, Member } from '../types';

export interface GroupSnapshotMeta {
    fromCache: boolean;
    hasPendingWrites: boolean;
}

export interface StorageService {
    /**
     * Creates a new group and returns it.
     */
    /**
     * Creates a new group and returns it.
     */
    createGroup(name: string, creator: { id: string; name: string; email?: string }, customId?: string, currency?: string): Promise<Group>;

    /**
     * Retrieves a group by ID.
     */
    getGroup(groupId: string): Promise<Group | null>;

    /**
     * Discovers groups the user owns or belongs to. Used to recover groups that
     * are missing from the local myGroups list.
     */
    getGroupsForUser(userId: string): Promise<Group[]>;

    /**
     * Subscribes to real-time updates for a group.
     * Calls onUpdate with the group data, or null if the group does not exist / was deleted.
     * The optional metadata mirrors the Firestore snapshot and is used to derive
     * the sync indicator without opening a second listener.
     * Returns an unsubscribe function.
     */
    subscribeToGroup(
        groupId: string,
        onUpdate: (group: Group | null, metadata?: GroupSnapshotMeta) => void,
        onError?: () => void
    ): () => void;

    /**
     * Adds an expense to the group.
     * Uses transactions to ensure data integrity.
     */
    addExpense(groupId: string, expense: Omit<Expense, 'id' | 'createdAt'> | Expense): Promise<void>;

    /**
     * Adds a member to the group.
     */
    addMember(groupId: string, member: Member): Promise<void>;

    /**
     * Removes a member from the group.
     */
    removeMember(groupId: string, memberId: string): Promise<void>;

    /**
     * Updates the status of a member in the group.
     */
    updateMemberStatus(groupId: string, memberId: string, status: 'active' | 'pending'): Promise<void>;

    /**
     * Merges two members, transferring expenses and removing the old member.
     */
    mergeMember(groupId: string, oldMemberId: string, newMemberId: string): Promise<void>;

    /**
     * Deletes an expense from the group.
     */
    deleteExpense(groupId: string, expenseId: string): Promise<void>;

    /**
     * Deletes a group completely.
     */
    deleteGroup(groupId: string): Promise<void>;

    /**
     * Updates group details (e.g. image).
     */
    updateGroup(groupId: string, updates: Partial<Group>): Promise<void>;


    /**
     * Gets metadata about the group's sync status.
     * Returns null if group doesn't exist.
     */
    getGroupMetadata(groupId: string): Promise<{ hasPendingWrites: boolean, fromCache: boolean } | null>;
}
