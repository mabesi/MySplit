import { StorageService } from './StorageInterface';
import { Group, Expense, Member } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 15);

export class MockService implements StorageService {
    private groups: Map<string, Group> = new Map();
    private subscribers: Map<string, ((group: Group) => void)[]> = new Map();

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
        const groupPlinio: Group = {
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
        };
        this.groups.set(groupPlinio.id, groupPlinio);

        // 2. Group: teste-manu (Created by Manu, Plínio NOT included)
        const groupManu: Group = {
            id: 'teste-manu',
            name: 'Festa da Manu',
            ownerId: members.manu.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
            members: [members.plinio, members.manu, members.dime, members.liza],
            expenses: []
        };
        this.groups.set(groupManu.id, groupManu);

        // 3. Group: teste-dime (Created by Dime, Plínio NOT included)
        const groupDime: Group = {
            id: 'teste-dime',
            name: 'Churras do Dime',
            ownerId: members.dime.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
            members: [members.dime, members.manu, members.liza],
            expenses: []
        };
        this.groups.set(groupDime.id, groupDime);

        // 4. Group: teste-liza (Created by Liza, Plínio NOT included)
        const groupLiza: Group = {
            id: 'teste-liza',
            name: 'Praia da Liza',
            ownerId: members.liza.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
            members: [members.liza, members.manu, members.dime],
            expenses: []
        };
        this.groups.set(groupLiza.id, groupLiza);
    }

    private notifySubscribers(groupId: string) {
        const group = this.groups.get(groupId);
        if (!group) return;
        const subs = this.subscribers.get(groupId) || [];
        subs.forEach(cb => cb(group));
    }

    async createGroup(name: string, creator: { id: string; name: string; email?: string }): Promise<Group> {
        // Generate ID: name-random
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const groupId = `${slug}-${randomSuffix}`;

        const newGroup: Group = {
            id: groupId,
            name,
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
        };

        this.groups.set(groupId, newGroup);
        return newGroup;
    }

    async getGroup(groupId: string): Promise<Group | null> {
        return this.groups.get(groupId) || null;
    }

    subscribeToGroup(groupId: string, onUpdate: (group: Group) => void): () => void {
        // Initial call
        const group = this.groups.get(groupId);
        if (group) onUpdate(group);

        // Add subscriber
        const subs = this.subscribers.get(groupId) || [];
        subs.push(onUpdate);
        this.subscribers.set(groupId, subs);

        return () => {
            const currentSubs = this.subscribers.get(groupId) || [];
            this.subscribers.set(groupId, currentSubs.filter(cb => cb !== onUpdate));
        };
    }

    async addExpense(groupId: string, expenseData: Omit<Expense, 'id' | 'createdAt'>): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) return;

        const newExpense: Expense = {
            id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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
        group.members.push(newMember);
        group.updatedAt = Date.now();
        this.groups.set(groupId, group);
        this.notifySubscribers(groupId);
    }

    async removeMember(groupId: string, memberId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) throw new Error("Group not found");

        // Remove the member
        group.members = group.members.filter(m => m.id !== memberId);

        // Remove all expenses paid by this member
        group.expenses = group.expenses.filter(e => e.paidBy !== memberId);

        group.updatedAt = Date.now();
        this.groups.set(groupId, group);
        this.notifySubscribers(groupId);
    }

    async updateMemberStatus(groupId: string, memberId: string, status: 'active' | 'pending'): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) throw new Error("Group not found");

        const member = group.members.find(m => m.id === memberId);
        if (member) {
            member.status = status;
            group.updatedAt = Date.now();
            this.groups.set(groupId, group);
            this.notifySubscribers(groupId);
        }
    }

    async mergeMember(groupId: string, oldMemberId: string, newMemberId: string): Promise<void> {
        const group = this.groups.get(groupId);
        if (!group) throw new Error("Group not found");

        // 1. Update expenses paid by oldMemberId
        group.expenses.forEach(e => {
            if (e.paidBy === oldMemberId) {
                e.paidBy = newMemberId;
            }
            // 2. Update splitAmong
            if (e.splitAmong.includes(oldMemberId)) {
                e.splitAmong = e.splitAmong.filter(id => id !== oldMemberId);
                if (!e.splitAmong.includes(newMemberId)) {
                    e.splitAmong.push(newMemberId);
                }
            }
        });

        // 3. Remove old member
        group.members = group.members.filter(m => m.id !== oldMemberId);

        group.updatedAt = Date.now();
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

    async uploadImage(uri: string, path: string): Promise<string> {
        return uri; // Mock just returns the local URI
    }
}
