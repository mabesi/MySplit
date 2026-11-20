import { StorageService } from './StorageInterface';
import { Group, Expense, Member } from '../types';
import {
    applyMemberApproval,
    applyMemberMerge,
    applyMemberRemoval,
    deriveMemberIds,
    prepareMemberApproval,
    withMemberIds
} from '../utils/memberLogic';
import { getDeviceCurrency } from '../utils/deviceCurrency';
import { normalizeCurrency } from '../utils/currency';

const generateId = () => Math.random().toString(36).substring(2, 15);

function buildGroup(data: Omit<Group, 'memberIds' | 'activeMemberIds'>): Group {
    const { memberIds, activeMemberIds } = deriveMemberIds(data.members);
    return { ...data, memberIds, activeMemberIds };
}

function applyGroupUpdate(target: Group, source: Group): void {
    target.members = source.members;
    target.expenses = source.expenses;
    target.memberIds = source.memberIds;
    target.activeMemberIds = source.activeMemberIds;
    target.updatedAt = source.updatedAt;
}

export class MockService implements StorageService {
    private groups: Map<string, Group> = new Map();
    private subscribers: Map<string, ((group: Group | null) => void)[]> = new Map();

    constructor() {
        this.initializeMockData();
    }

    private initializeMockData() {
        const members = {
            plinio: { id: 'user-plinio', name: 'Plínio' },
            manu: { id: 'user-manu', name: 'Manu' },
            dime: { id: 'user-dime', name: 'Dime' },
            liza: { id: 'user-liza', name: 'Liza' }
        };

        // 1. Group: teste-plinio (Created by Plínio, has all members)
        const groupPlinio: Group = buildGroup({
            id: 'teste-plinio',
            name: 'Viagem Plínio',
            ownerId: members.plinio.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
            members: [members.plinio, members.manu, members.dime, members.liza],
            expenses: [
                {
                    id: 'exp-1',
                    title: 'Almoço',
                    amount: 120.00,
                    paidBy: members.plinio.id,
                    splitAmong: [members.plinio.id, members.manu.id, members.dime.id],
                    createdAt: Date.now() - 100000,
                    date: Date.now() - 100000,
                    createdBy: members.plinio.id
                },
                {
                    id: 'exp-2',
                    title: 'Uber',
                    amount: 45.50,
                    paidBy: members.manu.id,
                    splitAmong: [members.manu.id, members.plinio.id, members.liza.id],
                    createdAt: Date.now() - 80000,
                    date: Date.now() - 80000,
                    createdBy: members.manu.id
                },
                {
                    id: 'exp-3',
                    title: 'Mercado',
                    amount: 250.00,
                    paidBy: members.dime.id,
                    splitAmong: [members.dime.id, members.plinio.id, members.manu.id, members.liza.id],
                    createdAt: Date.now() - 50000,
                    date: Date.now() - 50000,
                    createdBy: members.dime.id
                }
            ]
        });
        this.groups.set(groupPlinio.id, groupPlinio);

        // 2. Group: teste-manu (Created by Manu, Plínio NOT included)
        const groupManu: Group = buildGroup({
            id: 'teste-manu',
            name: 'Festa da Manu',
            ownerId: members.manu.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
            members: [members.plinio, members.manu, members.dime, members.liza],
            expenses: []
        });
        this.groups.set(groupManu.id, groupManu);

        // 3. Group: teste-dime (Created by Dime, Plínio NOT included)
        const groupDime: Group = buildGroup({
            id: 'teste-dime',
            name: 'Churras do Dime',
            ownerId: members.dime.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
            members: [members.dime, members.manu, members.liza],
            expenses: []
        });
        this.groups.set(groupDime.id, groupDime);

        // 4. Group: teste-liza (Created by Liza, Plínio NOT included)
        const groupLiza: Group = buildGroup({
            id: 'teste-liza',
            name: 'Praia da Liza',
            ownerId: members.liza.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
            members: [members.liza, members.manu, members.dime],
            expenses: []
        });
        this.groups.set(groupLiza.id, groupLiza);
    }

    private notifySubscribers(groupId: string) {
        const group = this.groups.get(groupId);
        if (!group) return;
        const subs = this.subscribers.get(groupId) || [];
        subs.forEach(cb => cb(group));
    }

    async createGroup(name: string, creator: { id: string; name: string; email?: string }, customId?: string, currency?: string): Promise<Group> {
        // Generate ID: name-random
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const groupId = customId || `${slug}-${randomSuffix}`;

        const newGroup: Group = buildGroup({
            id: groupId,
            name,
            currency: normalizeCurrency(currency || getDeviceCurrency()),
            ownerId: creator.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
            members: [{
                id: creator.id,
                name: creator.name,
                email: creator.email,
                status: 'active'
            }],
            expenses: []
        });

        this.groups.set(groupId, newGroup);
        return newGroup;
    }

    async getGroup(groupId: string): Promise<Group | null> {
        return this.groups.get(groupId) || null;
    }

    async getGroupsForUser(userId: string): Promise<Group[]> {
        return Array.from(this.groups.values()).filter(group =>
            group.ownerId === userId ||
            (group.memberIds || group.members.map(member => member.id)).includes(userId)
        );
    }

    subscribeToGroup(groupId: string, onUpdate: (group: Group | null) => void): () => void {
        // Initial call
        const group = this.groups.get(groupId);
        onUpdate(group || null);

        // Add subscriber
        const subs = this.subscribers.get(groupId) || [];
        subs.push(onUpdate);
        this.subscribers.set(groupId, subs);

        return () => {
            const currentSubs = this.subscribers.get(groupId) || [];
            this.subscribers.set(groupId, currentSubs.filter(cb => cb !== onUpdate));
        };
    }

    async addExpense(groupId: string, expenseData: Omit<Expense, 'id' | 'createdAt'> | Expense): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) return;

        const newExpense: Expense = {
            id: 'id' in expenseData ? (expenseData as any).id : `exp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            ...expenseData,
            createdAt: Date.now()
        };

        group.expenses.push(newExpense);
        group.updatedAt = Date.now();
        this.notifySubscribers(groupId);
    }

    async addMember(groupId: string, member: Member): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) throw new Error("Group not found");

        // Check if name is taken
        const existingMember = group.members.find(m => m.name.toLowerCase() === member.name.toLowerCase());
        if (existingMember) {
            if (existingMember.id !== member.id) {
                throw new Error("Name taken");
            }
            // If ID matches, it's the same person re-joining or updating.
            // If they were pending, keep them pending? Or maybe this is a retry?
            // For now, just return, assuming no status change on re-join.
            return;
        }

        // New member joins (default to pending if not specified)
        const newMember = { ...member, status: member.status || 'pending' };
        const updated = withMemberIds({
            ...group,
            members: [...group.members, newMember],
            updatedAt: Date.now()
        });
        applyGroupUpdate(group, updated);
        this.groups.set(groupId, group);
        this.notifySubscribers(groupId);
    }

    async removeMember(groupId: string, memberId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) throw new Error("Group not found");

        const updated = applyMemberRemoval(group, memberId);
        if (updated === group) return;

        applyGroupUpdate(group, updated);
        this.groups.set(groupId, group);
        this.notifySubscribers(groupId);
    }

    async updateMemberStatus(groupId: string, memberId: string, status: 'active' | 'pending'): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) throw new Error("Group not found");

        if (status === 'pending') {
            const updated = withMemberIds({
                ...group,
                members: group.members.map(m =>
                    m.id === memberId ? { ...m, status } : m
                ),
                updatedAt: Date.now()
            });
            applyGroupUpdate(group, updated);
            this.groups.set(groupId, group);
            this.notifySubscribers(groupId);
            return;
        }

        const plan = prepareMemberApproval(group, memberId);
        if (!plan.ok) {
            throw new Error(plan.reason === 'name_reserved' ? 'Name reserved for the group creator' : 'Name already in use');
        }

        const updated = applyMemberApproval(group, memberId, plan.mergeMemberId);
        applyGroupUpdate(group, updated);
        this.groups.set(groupId, group);
        this.notifySubscribers(groupId);
    }

    async mergeMember(groupId: string, oldMemberId: string, newMemberId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) throw new Error("Group not found");

        const updated = applyMemberMerge(group, oldMemberId, newMemberId);
        if (updated === group) return;

        applyGroupUpdate(group, updated);
        this.groups.set(groupId, group);
        this.notifySubscribers(groupId);
    }

    async deleteExpense(groupId: string, expenseId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) throw new Error("Group not found");

        group.expenses = group.expenses.filter(e => e.id !== expenseId);
        group.updatedAt = Date.now();
        this.notifySubscribers(groupId);
    }

    async deleteGroup(groupId: string): Promise<void> {
        this.groups.delete(groupId);
        this.subscribers.delete(groupId);
    }

    async updateGroup(groupId: string, updates: Partial<Group>): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) throw new Error("Group not found");

        const updatedGroup = { ...group, ...updates, updatedAt: Date.now() };
        this.groups.set(groupId, updatedGroup);
        this.notifySubscribers(groupId);
    }

    async uploadImage(image: string, path: string): Promise<string> {
        return image; // Mock upload
    }

    async getGroupMetadata(groupId: string): Promise<{ hasPendingWrites: boolean, fromCache: boolean } | null> {
        const group = this.groups.get(groupId);
        if (!group) return null;
        return { hasPendingWrites: false, fromCache: false };
    }
}
