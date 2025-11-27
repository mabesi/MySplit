export interface Member {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
    status?: 'active' | 'pending';
}

export interface Expense {
    id: string;
    title: string;
    amount: number;
    paidBy: string; // Member ID
    splitAmong: string[]; // Member IDs
    date: number; // Timestamp of expense date
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
}

export type GroupUpdate = Partial<Omit<Group, 'id' | 'createdAt' | 'version'>>;
