export interface Member {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
    status?: 'active' | 'pending';
    // Manual members created by the group owner. A real account can assume one
    // same-name virtual member when the owner approves the join request.
    virtual?: boolean;
}

export interface Expense {
    id: string;
    title: string;
    amount: number;
    paidBy: string; // Member ID
    splitAmong: string[]; // Member IDs
    date: number; // Timestamp used for sorting and legacy compatibility
    dateString?: string; // Calendar date YYYY-MM-DD used for display
    createdBy: string; // Member ID who created the expense
    createdAt: number;
}

export interface Group {
    id: string;
    name: string;
    imageUrl?: string;
    ownerId: string;
    createdAt: number;
    updatedAt: number;
    version: number; // For optimistic concurrency or migration
    members: Member[];
    expenses: Expense[];
    // Derived from `members` and used by Firestore Rules to check membership
    // cheaply (rules cannot iterate over an array of member objects).
    memberIds: string[];
    activeMemberIds: string[];
}

export type GroupUpdate = Partial<Omit<Group, 'id' | 'createdAt' | 'version'>>;
