import { Group, Expense, Member } from '../types';

export interface Balance {
    memberId: string;
    memberName: string;
    balance: number; // Positive = Owed to them, Negative = They owe
}

export interface Transaction {
    from: string; // Member Name
    to: string; // Member Name
    amount: number;
}

export function calculateBalances(group: Group): { balances: Balance[], transactions: Transaction[] } {
    const balances: Record<string, number> = {};

    // Pending requests are not part of the group yet, so they take no part in
    // balances or settlements.
    const activeMembers = group.members.filter(m => m.status !== 'pending');

    // Initialize 0
    activeMembers.forEach(m => balances[m.id] = 0);

    group.expenses.forEach(expense => {
        const paidBy = expense.paidBy;

        // Ignore references to members that no longer exist (legacy data from
        // removals that did not clean up splitAmong/paidBy).
        if (!(paidBy in balances)) return;

        const participants = expense.splitAmong.filter(memberId => memberId in balances);
        const splitCount = participants.length;

        if (splitCount === 0) return;

        const amount = expense.amount;
        const splitAmount = amount / splitCount;

        // Payer gets positive balance (they are owed)
        balances[paidBy] = (balances[paidBy] || 0) + amount;

        // Splitters get negative balance (they owe)
        participants.forEach(memberId => {
            balances[memberId] = (balances[memberId] || 0) - splitAmount;
        });
    });

    const balanceList: Balance[] = activeMembers.map(m => ({
        memberId: m.id,
        memberName: m.name,
        balance: balances[m.id] || 0
    }));

    // Calculate simplified transactions - use COPIES to avoid mutating balanceList
    const debtorsCopy = balanceList
        .filter(b => b.balance < -0.01)
        .map(b => ({ ...b })) // Create copy
        .sort((a, b) => a.balance - b.balance);

    const creditorsCopy = balanceList
        .filter(b => b.balance > 0.01)
        .map(b => ({ ...b })) // Create copy
        .sort((a, b) => b.balance - a.balance);

    const transactions: Transaction[] = [];

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtorsCopy.length && j < creditorsCopy.length) {
        const debtor = debtorsCopy[i];
        const creditor = creditorsCopy[j];

        const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

        transactions.push({
            from: debtor.memberName,
            to: creditor.memberName,
            amount
        });

        debtor.balance += amount;
        creditor.balance -= amount;

        if (Math.abs(debtor.balance) < 0.01) i++;
        if (creditor.balance < 0.01) j++;
    }

    return { balances: balanceList, transactions };
}
