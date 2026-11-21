import { Group } from '../types';
import { fromMinorUnits, normalizeCurrency, toMinorUnits } from './currency';

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
    const currency = normalizeCurrency(group.currency);

    // Pending requests are not part of the group yet, so they take no part in
    // balances or settlements.
    const activeMembers = group.members.filter(m => m.status !== 'pending');
    const activeIds = new Set(activeMembers.map(m => m.id));

    // Work in the currency's minor units so splitting cannot lose a cent.
    const balancesMinor: Record<string, number> = {};
    activeMembers.forEach(m => balancesMinor[m.id] = 0);

    group.expenses.forEach(expense => {
        const paidBy = expense.paidBy;

        // Ignore references to members that no longer exist (legacy data from
        // removals that did not clean up splitAmong/paidBy).
        if (!activeIds.has(paidBy)) return;

        const participants = expense.splitAmong.filter(memberId => activeIds.has(memberId));
        if (participants.length === 0) return;

        const amountMinor = toMinorUnits(expense.amount, currency);

        if (amountMinor <= 0) return;

        const base = Math.floor(amountMinor / participants.length);
        const remainder = amountMinor % participants.length;

        // Payer gets positive balance (they are owed)
        balancesMinor[paidBy] += amountMinor;

        // Splitters get negative balance (they owe). The remainder is
        // distributed one minor unit at a time so the sum is exact.
        participants.forEach((memberId, index) => {
            balancesMinor[memberId] -= base + (index < remainder ? 1 : 0);
        });
    });

    const balanceList: Balance[] = activeMembers.map(m => ({
        memberId: m.id,
        memberName: m.name,
        balance: fromMinorUnits(balancesMinor[m.id], currency)
    }));

    // Calculate simplified transactions - use COPIES to avoid mutating balanceList
    const debtors = activeMembers
        .map(m => ({ memberId: m.id, memberName: m.name, balanceMinor: balancesMinor[m.id] }))
        .filter(b => b.balanceMinor < 0)
        .sort((a, b) => a.balanceMinor - b.balanceMinor);

    const creditors = activeMembers
        .map(m => ({ memberId: m.id, memberName: m.name, balanceMinor: balancesMinor[m.id] }))
        .filter(b => b.balanceMinor > 0)
        .sort((a, b) => b.balanceMinor - a.balanceMinor);

    const transactions: Transaction[] = [];

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const amountMinor = Math.min(Math.abs(debtor.balanceMinor), creditor.balanceMinor);

        if (amountMinor <= 0) break;

        transactions.push({
            from: debtor.memberName,
            to: creditor.memberName,
            amount: fromMinorUnits(amountMinor, currency)
        });

        debtor.balanceMinor += amountMinor;
        creditor.balanceMinor -= amountMinor;

        if (debtor.balanceMinor === 0) i++;
        if (creditor.balanceMinor === 0) j++;
    }

    return { balances: balanceList, transactions };
}
