import {
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    onSnapshot,
    deleteDoc,
    runTransaction,
    collection,
    query,
    where,
    limit
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
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
            expenses: [],
            memberIds: [creatorId],
            activeMemberIds: [creatorId]
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
        }

        // A cached "does not exist" is not proof that the group was deleted.
        // Throwing lets callers keep the local copy instead of removing it.
        if (docSnap.metadata.fromCache) {
            throw new Error(`Group ${groupId} is not available from cache`);
        }

        console.warn(`⚠️ Group ${groupId} not found`);
        return null;
    }

    async getGroupsForUser(userId: string): Promise<Group[]> {
        const groupsRef = collection(db, 'groups');
        const [owned, member] = await Promise.all([
            getDocs(query(groupsRef, where('ownerId', '==', userId), limit(100))),
            getDocs(query(groupsRef, where('memberIds', 'array-contains', userId), limit(100)))
        ]);

        const byId = new Map<string, Group>();
        owned.forEach(docSnap => {
            byId.set(docSnap.id, docSnap.data() as Group);
        });
        member.forEach(docSnap => {
            if (!byId.has(docSnap.id)) {
                byId.set(docSnap.id, docSnap.data() as Group);
            }
        });

        return Array.from(byId.values());
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
                } else if (
                    !snapshot.metadata.fromCache &&
                    !snapshot.metadata.hasPendingWrites
                ) {
                    // Only a server-confirmed deletion removes the local copy.
                    // A cache miss while offline must not hide the group.
                    console.warn(`⚠️ Group ${groupId} was deleted on the server`);
                    callback(null);
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
            createdAt: 'createdAt' in expenseData ? (expenseData as Expense).createdAt : Date.now()
        };

        await runTransaction(db, async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists()) throw new Error("Group not found");

            const group = groupDoc.data() as Group;
            if ((group.expenses || []).some(expense => expense.id === newExpense.id)) {
                return;
            }

            // Backfill the id arrays for groups created before they existed.
            const derived = deriveMemberIds(group.members);
            const memberIds = Array.isArray(group.memberIds) ? group.memberIds : derived.memberIds;
            const activeMemberIds = Array.isArray(group.activeMemberIds)
                ? group.activeMemberIds
                : derived.activeMemberIds;

            transaction.update(groupRef, {
                expenses: [...(group.expenses || []), newExpense],
                memberIds,
                activeMemberIds,
                updatedAt: Date.now()
            });
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

        // Use a transaction so retries are idempotent and old documents without
        // the id arrays are backfilled from the full member list.
        await runTransaction(db, async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists()) throw new Error("Group not found");

            const group = groupDoc.data() as Group;
            if (group.members.some(member => member.id === memberData.id)) return;

            const members = [...group.members, cleanMember];
            const { memberIds, activeMemberIds } = deriveMemberIds(members);

            transaction.update(groupRef, {
                members,
                memberIds,
                activeMemberIds,
                updatedAt: Date.now()
            });
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
                memberIds: updated.memberIds,
                activeMemberIds: updated.activeMemberIds,
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
                memberIds: updated.memberIds,
                activeMemberIds: updated.activeMemberIds,
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
                const updated = withMemberIds({ ...group, members, updatedAt: Date.now() });

                transaction.update(groupRef, {
                    members: updated.members,
                    memberIds: updated.memberIds,
                    activeMemberIds: updated.activeMemberIds,
                    updatedAt: updated.updatedAt
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
                memberIds: updated.memberIds,
                activeMemberIds: updated.activeMemberIds,
                updatedAt: updated.updatedAt
            });
        });
    }

    async deleteExpense(groupId: string, expenseId: string): Promise<void> {
        const groupRef = doc(db, 'groups', groupId);

        await runTransaction(db, async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists()) throw new Error("Group not found");

            const group = groupDoc.data() as Group;
            const derived = deriveMemberIds(group.members);

            // Backfill the id arrays for groups created before they existed.
            transaction.update(groupRef, {
                expenses: (group.expenses || []).filter(expense => expense.id !== expenseId),
                memberIds: Array.isArray(group.memberIds) ? group.memberIds : derived.memberIds,
                activeMemberIds: Array.isArray(group.activeMemberIds)
                    ? group.activeMemberIds
                    : derived.activeMemberIds,
                updatedAt: Date.now()
            });
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
