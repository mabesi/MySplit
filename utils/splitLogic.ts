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

    // Initialize 0
    group.members.forEach(m => balances[m.id] = 0);

    group.expenses.forEach(expense => {
        const paidBy = expense.paidBy;
        const amount = expense.amount;
        const splitCount = expense.splitAmong.length;

        if (splitCount === 0) return;

        const splitAmount = amount / splitCount;

        // Payer gets positive balance (they are owed)
        balances[paidBy] = (balances[paidBy] || 0) + amount;

        // Splitters get negative balance (they owe)
        expense.splitAmong.forEach(memberId => {
            balances[memberId] = (balances[memberId] || 0) - splitAmount;
        });
    });

    const balanceList: Balance[] = group.members.map(m => ({
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
