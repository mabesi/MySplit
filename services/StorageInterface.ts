import { Group, Expense, Member } from '../types';

export interface StorageService {
    /**
     * Creates a new group and returns it.
     */
    /**
     * Creates a new group and returns it.
     */
    createGroup(name: string, creator: { id: string; name: string; email?: string }, customId?: string): Promise<Group>;

    /**
     * Retrieves a group by ID.
     */
    getGroup(groupId: string): Promise<Group | null>;

    /**
     * Subscribes to real-time updates for a group.
     * Returns an unsubscribe function.
     */
    subscribeToGroup(groupId: string, onUpdate: (group: Group) => void): () => void;

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
     * Uploads an image and returns the download URL.
     */
    uploadImage(image: string, path: string): Promise<string>;

    /**
     * Gets metadata about the group's sync status.
     * Returns null if group doesn't exist.
     */
    getGroupMetadata(groupId: string): Promise<{ hasPendingWrites: boolean, fromCache: boolean } | null>;
}
