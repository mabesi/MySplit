import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    arrayUnion,
    arrayRemove,
    deleteDoc,
    runTransaction
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { StorageService } from './StorageInterface';
import { Group, Expense, Member } from '../types';
import {
    applyMemberApproval,
    applyMemberMerge,
    applyMemberRemoval,
    prepareMemberApproval
} from '../utils/memberLogic';


// Polyfill for UUID if expo-crypto is not available or just use a simple one for now
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export class FirebaseService implements StorageService {

    async createGroup(name: string, creator: { id: string; name: string; email?: string }, customId?: string): Promise<Group> {
        const groupId = customId || generateId();
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

    subscribeToGroup(groupId: string, callback: (group: Group | null) => void): () => void {
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
                } else {
                    // Document does NOT exist in Firestore (deleted or not found)
                    if (!snapshot.metadata.hasPendingWrites) {
                        console.warn(`⚠️ Group ${groupId} does not exist in Firestore (deleted or not found)`);
                        callback(null);
                    }
                }
            },
            (error) => {
                console.error(`❌ Subscription error for group ${groupId}:`, error);
            }
        );

        return unsubscribe;
    }

    async addExpense(groupId: string, expenseData: Omit<Expense, 'id' | 'createdAt'> | Expense): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);

        const newExpense: Expense = {
            ...expenseData,
            id: 'id' in expenseData ? (expenseData as Expense).id : generateId(),
            // Preserve createdAt when the caller already built the expense.
            // This keeps the object identical across retries so arrayUnion
            // deduplicates it instead of creating a duplicate.
            createdAt: 'createdAt' in expenseData ? (expenseData as Expense).createdAt : Date.now()
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
        if (memberData.virtual) cleanMember.virtual = true;

        await updateDoc(groupRef, {
            members: arrayUnion(cleanMember),
            updatedAt: Date.now()
        });
    }

    async removeMember(groupId: string, memberId: string): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);

        await runTransaction(db, async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists()) throw new Error("Group not found");

            const group = groupDoc.data() as Group;
            const updated = applyMemberRemoval(group, memberId);

            if (updated === group) return;

            transaction.update(groupRef, {
                members: updated.members,
                expenses: updated.expenses,
                updatedAt: updated.updatedAt
            });
        });
    }

    async mergeMember(groupId: string, oldMemberId: string, newMemberId: string): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);

        await runTransaction(db, async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists()) throw new Error("Group not found");

            const group = groupDoc.data() as Group;
            const updated = applyMemberMerge(group, oldMemberId, newMemberId);

            if (updated === group) return;

            transaction.update(groupRef, {
                members: updated.members,
                expenses: updated.expenses,
                updatedAt: updated.updatedAt
            });
        });
    }

    async updateMemberStatus(groupId: string, memberId: string, status: 'active' | 'pending'): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);

        await runTransaction(db, async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists()) throw new Error("Group not found");

            const group = groupDoc.data() as Group;

            if (status === 'pending') {
                const members = group.members.map(member =>
                    member.id === memberId ? { ...member, status } : member
                );

                transaction.update(groupRef, {
                    members,
                    updatedAt: Date.now()
                });
                return;
            }

            const plan = prepareMemberApproval(group, memberId);
            if (!plan.ok) {
                if (plan.reason === 'not_found') return;

                throw new Error(
                    plan.reason === 'name_reserved'
                        ? 'Name reserved for the group creator'
                        : 'Name already in use'
                );
            }

            const updated = applyMemberApproval(group, memberId, plan.mergeMemberId);

            transaction.update(groupRef, {
                members: updated.members,
                expenses: updated.expenses,
                updatedAt: updated.updatedAt
            });
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

    async getGroupMetadata(groupId: string): Promise<{ hasPendingWrites: boolean, fromCache: boolean } | null> {
        const docRef = doc(db, 'groups', groupId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return {
            hasPendingWrites: docSnap.metadata.hasPendingWrites,
            fromCache: docSnap.metadata.fromCache
        };
    }
}
