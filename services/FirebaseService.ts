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
        const docRef = doc(db, 'groups', groupId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as Group;
        } else {
            return null;
        }
    }

    subscribeToGroup(groupId: string, onUpdate: (group: Group) => void): () => void {
        const docRef = doc(db, 'groups', groupId);
        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                onUpdate(doc.data() as Group);
            }
        });
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

        // We can't easily use arrayRemove for expenses filtering, so we might need to read-modify-write for expenses
        // But for members we can use arrayRemove IF we have the exact object. 
        // Since we just fetched it, we can use it.

        // However, we also need to remove expenses paid by this member.
        // This operation is complex for atomic updateDoc without transactions if we want to filter expenses.
        // But since we want offline support, we accept the read-modify-write pattern using updateDoc with the calculated new arrays.
        // This is "safe enough" for offline, though theoretically prone to race conditions if someone else adds an expense at the exact same time.

        const updatedMembers = group.members.filter(m => m.id !== memberId);
        const updatedExpenses = group.expenses.filter(e => e.paidBy !== memberId);

        await updateDoc(groupRef, {
            members: updatedMembers,
            expenses: updatedExpenses,
            updatedAt: Date.now()
        });
    }

    async updateMemberStatus(groupId: string, memberId: string, status: 'active' | 'pending'): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);
        const groupDoc = await getDoc(groupRef);

        if (!groupDoc.exists()) throw new Error("Group not found");

        const group = groupDoc.data() as Group;
        const updatedMembers = group.members.map(m =>
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
