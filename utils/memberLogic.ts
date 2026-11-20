import type { Group, Member } from '../types';

/**
 * Pure member rules shared by the local context and the server implementation.
 * Keeping them in one place guarantees that the optimistic local state and the
 * Firestore transaction produce the same result.
 */

export type NameConflict =
    | { type: 'owner'; member: Member }
    | { type: 'active'; member: Member }
    | { type: 'pending'; member: Member }
    | { type: 'virtual'; member: Member }
    | { type: 'ambiguous'; members: Member[] };

export type ApprovalPlan =
    | { ok: true; mergeMemberId?: string }
    | { ok: false; reason: 'name_taken' | 'name_reserved' | 'not_found' };

export function normalizeName(name: string): string {
    // Case- and accent-insensitive so "João", "joão" and "Joao" are treated as
    // the same person when checking uniqueness or assuming a virtual member.
    return name
        .trim()
        .toLocaleLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Manual members created by the group owner have no account yet. They are the
 * only members that a real account is allowed to "assume" when joining.
 */
export function isVirtualMember(member: Member): boolean {
    return member.virtual === true || member.id.startsWith('user-');
}

/**
 * Finds a member that already uses `name`.
 *
 * Priority matters:
 * 1. the group creator name is always reserved;
 * 2. a real account name is taken;
 * 3. another pending request reserves the name;
 * 4. a single virtual member may be assumed by the pending account;
 * 5. multiple virtual members are ambiguous and must be resolved manually.
 */
export function findNameConflict(
    group: Group,
    name: string,
    excludeMemberId?: string
): NameConflict | null {
    const normalized = normalizeName(name);
    if (!normalized) return null;

    const matches = group.members.filter(
        member => member.id !== excludeMemberId && normalizeName(member.name) === normalized
    );

    if (matches.length === 0) return null;

    const owner = matches.find(member => member.id === group.ownerId);
    if (owner) return { type: 'owner', member: owner };

    const active = matches.find(member => !isVirtualMember(member) && member.status !== 'pending');
    if (active) return { type: 'active', member: active };

    const pending = matches.find(member => member.status === 'pending');
    if (pending) return { type: 'pending', member: pending };

    const virtual = matches.filter(isVirtualMember);
    if (virtual.length === 1) return { type: 'virtual', member: virtual[0] };
    if (virtual.length > 1) return { type: 'ambiguous', members: virtual };

    return null;
}

/**
 * Decides whether a pending request can be approved.
 *
 * A single same-name virtual member is returned as `mergeMemberId` so the
 * caller can transfer its history to the real account.
 */
export function prepareMemberApproval(group: Group, memberId: string): ApprovalPlan {
    const target = group.members.find(member => member.id === memberId);
    if (!target) return { ok: false, reason: 'not_found' };
    if (target.status === 'active') return { ok: true };

    const conflict = findNameConflict(group, target.name, memberId);
    if (!conflict) return { ok: true };
    if (conflict.type === 'virtual') return { ok: true, mergeMemberId: conflict.member.id };
    if (conflict.type === 'owner') return { ok: false, reason: 'name_reserved' };

    return { ok: false, reason: 'name_taken' };
}

/**
 * Transfers every financial reference from `oldMemberId` to `newMemberId` and
 * removes the old member. The group owner is never merged away.
 */
export function applyMemberMerge(group: Group, oldMemberId: string, newMemberId: string): Group {
    if (oldMemberId === newMemberId) return group;
    if (group.ownerId === oldMemberId || group.ownerId === newMemberId) {
        throw new Error('Cannot merge the group owner');
    }

    const oldMember = group.members.find(member => member.id === oldMemberId);
    const newMember = group.members.find(member => member.id === newMemberId);
    if (!oldMember || !newMember) return group;

    const expenses = group.expenses.map(expense => {
        let changed = false;
        let paidBy = expense.paidBy;
        let splitAmong = expense.splitAmong;
        let createdBy = expense.createdBy;

        if (paidBy === oldMemberId) {
            paidBy = newMemberId;
            changed = true;
        }

        if (splitAmong.includes(oldMemberId)) {
            splitAmong = splitAmong.filter(id => id !== oldMemberId);
            if (!splitAmong.includes(newMemberId)) {
                splitAmong.push(newMemberId);
            }
            changed = true;
        }

        if (createdBy === oldMemberId) {
            createdBy = newMemberId;
            changed = true;
        }

        return changed ? { ...expense, paidBy, splitAmong, createdBy } : expense;
    });

    const members = group.members.filter(member => member.id !== oldMemberId);
    return { ...group, members, expenses, updatedAt: Date.now() };
}

/**
 * Applies an approval plan. When a virtual member is being assumed, its name is
 * kept as the canonical name of the real account.
 */
export function applyMemberApproval(
    group: Group,
    memberId: string,
    mergeMemberId?: string
): Group {
    const virtual = mergeMemberId
        ? group.members.find(member => member.id === mergeMemberId)
        : undefined;

    const base = mergeMemberId ? applyMemberMerge(group, mergeMemberId, memberId) : group;

    const members = base.members.map(member =>
        member.id === memberId
            ? {
                ...member,
                status: 'active' as const,
                ...(virtual ? { name: virtual.name } : {})
            }
            : member
    );

    return { ...base, members, updatedAt: Date.now() };
}

/**
 * Removes a member and all expenses paid by them. Their ID is also removed
 * from `splitAmong`; expenses left without participants are dropped. The
 * remaining expenses are therefore recalculated only with the remaining
 * members.
 */
export function applyMemberRemoval(group: Group, memberId: string): Group {
    if (memberId === group.ownerId) {
        throw new Error('Cannot remove the group owner');
    }

    if (!group.members.some(member => member.id === memberId)) {
        return group;
    }

    const members = group.members.filter(member => member.id !== memberId);

    const expenses = group.expenses
        .filter(expense => expense.paidBy !== memberId)
        .map(expense =>
            expense.splitAmong.includes(memberId)
                ? { ...expense, splitAmong: expense.splitAmong.filter(id => id !== memberId) }
                : expense
        )
        .filter(expense => expense.splitAmong.length > 0);

    return { ...group, members, expenses, updatedAt: Date.now() };
}
