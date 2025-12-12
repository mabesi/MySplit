import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    arrayUnion,
    arrayRemove,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { StorageService } from './StorageInterface';
import { Group, Expense, Member } from '../types';


// Polyfill for UUID if expo-crypto is not available or just use a simple one for now
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export class FirebaseService implements StorageService {

    async createGroup(name: string, creator: { id: string; name: string; email?: string }): Promise<Group> {
        const groupId = generateId();
        const creatorId = creator.id; // Use provided ID

        const newGroup: Group = {
            id: groupId,
            name,
            ownerId: creatorId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
            members: [{
                id: creatorId,
                name: creator.name,
                ...(creator.email ? { email: creator.email } : {}), // Only include email if defined
                status: 'active'
            }],
            expenses: []
        };

        await setDoc(doc(db, 'groups', groupId), newGroup);
        return newGroup;
    }

    async getGroup(groupId: string): Promise<Group | null> {
        console.log(`📥 FirebaseService: Getting group ${groupId}...`);
        const docRef = doc(db, 'groups', groupId);
        const docSnap = await getDoc(docRef);

        console.log(`📊 Group ${groupId}:`, {
            exists: docSnap.exists(),
            fromCache: docSnap.metadata.fromCache,
            hasPendingWrites: docSnap.metadata.hasPendingWrites
        });

        if (docSnap.exists()) {
            return docSnap.data() as Group;
        } else {
            console.warn(`⚠️ Group ${groupId} not found`);
            return null;
        }
    }

    subscribeToGroup(groupId: string, callback: (group: Group) => void): () => void {
        console.log(`🔔 FirebaseService: Subscribing to group ${groupId}...`);
        const groupRef = doc(db, 'groups', groupId);

        const unsubscribe = onSnapshot(
            groupRef,
            { includeMetadataChanges: true },
            (snapshot) => {
                console.log(`🔔 Group ${groupId} update:`, {
                    exists: snapshot.exists(),
                    fromCache: snapshot.metadata.fromCache,
                    hasPendingWrites: snapshot.metadata.hasPendingWrites
                });

                if (snapshot.exists()) {
                    callback(snapshot.data() as Group);
                }
            },
            (error) => {
                console.error(`❌ Subscription error for group ${groupId}:`, error);
            }
        );

        return unsubscribe;
    }

    async addExpense(groupId: string, expenseData: Omit<Expense, 'id' | 'createdAt'>): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);

        const newExpense: Expense = {
            ...expenseData,
            id: generateId(),
            createdAt: Date.now()
        };

        await updateDoc(groupRef, {
            expenses: arrayUnion(newExpense),
            updatedAt: Date.now()
        });
    }

    async addMember(groupId: string, memberData: Member): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);

        // Clean member data to remove undefined fields
        const cleanMember: any = {
            id: memberData.id,
            name: memberData.name
        };
        if (memberData.email) cleanMember.email = memberData.email;
        if (memberData.status) cleanMember.status = memberData.status;
        if (memberData.avatarUrl) cleanMember.avatarUrl = memberData.avatarUrl;

        await updateDoc(groupRef, {
            members: arrayUnion(cleanMember),
            updatedAt: Date.now()
        });
    }

    async removeMember(groupId: string, memberId: string): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);
        const groupDoc = await getDoc(groupRef);

        if (!groupDoc.exists()) throw new Error("Group not found");

        const group = groupDoc.data() as Group;
        const memberToRemove = group.members.find(m => m.id === memberId);

        if (!memberToRemove) return; // Member not found, nothing to do

        const updatedMembers = group.members.filter(m => m.id !== memberId);
        const updatedExpenses = group.expenses.filter(e => e.paidBy !== memberId);

        await updateDoc(groupRef, {
            members: updatedMembers,
            expenses: updatedExpenses,
            updatedAt: Date.now()
        });
    }

    async mergeMember(groupId: string, oldMemberId: string, newMemberId: string): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);
        const groupDoc = await getDoc(groupRef);

        if (!groupDoc.exists()) throw new Error("Group not found");

        const group = groupDoc.data() as Group;

        // 1. Update expenses
        const updatedExpenses = group.expenses.map(e => {
            let updated = false;
            let newPaidBy = e.paidBy;
            let newSplitAmong = [...e.splitAmong];

            if (e.paidBy === oldMemberId) {
                newPaidBy = newMemberId;
                updated = true;
            }

            if (newSplitAmong.includes(oldMemberId)) {
                newSplitAmong = newSplitAmong.filter(id => id !== oldMemberId);
                if (!newSplitAmong.includes(newMemberId)) {
                    newSplitAmong.push(newMemberId);
                }
                updated = true;
            }

            if (updated) {
                return { ...e, paidBy: newPaidBy, splitAmong: newSplitAmong };
            }
            return e;
        });

        // 2. Remove old member
        const updatedMembers = group.members.filter(m => m.id !== oldMemberId);

        await updateDoc(groupRef, {
            expenses: updatedExpenses,
            members: updatedMembers,
            updatedAt: Date.now()
        });
    }

    async updateMemberStatus(groupId: string, memberId: string, status: 'active' | 'pending'): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);
        const groupDoc = await getDoc(groupRef);

        if (!groupDoc.exists()) throw new Error("Group not found");

        const group = groupDoc.data() as Group;
        const memberToUpdate = group.members.find(m => m.id === memberId);

        if (!memberToUpdate) return;

        // Check for duplicate name if approving
        if (status === 'active') {
            const existingActiveMember = group.members.find(m =>
                m.id !== memberId &&
                m.status !== 'pending' &&
                m.name.toLowerCase() === memberToUpdate.name.toLowerCase()
            );

            if (existingActiveMember) {
                // MERGE!
                console.log(`Merging member ${existingActiveMember.name} (${existingActiveMember.id}) into ${memberToUpdate.id}`);
                await this.mergeMember(groupId, existingActiveMember.id, memberId);
            }
        }

        // Re-fetch group to be safe after merge
        const freshDoc = await getDoc(groupRef);
        const freshGroup = freshDoc.data() as Group;

        const updatedMembers = freshGroup.members.map(m =>
            m.id === memberId ? { ...m, status } : m
        );

        await updateDoc(groupRef, {
            members: updatedMembers,
            updatedAt: Date.now()
        });
    }

    async deleteExpense(groupId: string, expenseId: string): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);
        const groupDoc = await getDoc(groupRef);

        if (!groupDoc.exists()) throw new Error("Group not found");

        const group = groupDoc.data() as Group;
        const updatedExpenses = group.expenses.filter(e => e.id !== expenseId);

        await updateDoc(groupRef, {
            expenses: updatedExpenses,
            updatedAt: Date.now()
        });
    }

    async deleteGroup(groupId: string): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);
        await deleteDoc(groupRef);
    }

    async updateGroup(groupId: string, updates: Partial<Group>): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);

        await updateDoc(groupRef, {
            ...updates,
            updatedAt: Date.now()
        });
    }

    async uploadImage(image: string, path: string): Promise<string> {
        // Image is already a Base64 Data URI from the picker
        return image;
    }
}
