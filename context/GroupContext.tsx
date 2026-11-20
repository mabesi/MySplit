
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Group, Expense, Member } from '../types';
import { StorageService } from '../services/StorageInterface';
import { FirebaseService } from '../services/FirebaseService';
import { MockService } from '../services/MockService';
import { LocalGroupStore } from '../services/LocalGroupStore';
import { OperationQueue, NewOperation } from '../services/OperationQueue';
import { OperationProcessor } from '../services/OperationProcessor';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import { auth as firebaseAuth } from '../firebaseConfig';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import i18n from '../i18n/translations';

const USE_MOCK = false;
const storageService: StorageService = USE_MOCK ? new MockService() : new FirebaseService();

const makeOperationId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

interface GroupContextType {
    currentGroup: Group | null;
    myGroups: string[];
    userId: string;
    isLoading: boolean;
    createGroup: (name: string, userName: string) => Promise<string>;
    getGroup: (groupId: string) => Promise<Group | null>;
    joinGroup: (groupId: string, userName?: string) => Promise<{ success: boolean; status: 'joined' | 'already_member' | 'name_taken' | 'error' | 'group_not_found'; memberName?: string }>;
    addExpense: (title: string, amount: number, paidBy: string, splitAmong: string[], date?: number) => Promise<void>;
    addMember: (name: string) => Promise<void>;
    removeMember: (memberId: string) => Promise<void>;
    deleteExpense: (expenseId: string) => Promise<void>;
    deleteGroup: () => Promise<void>;
    updateGroupImage: (url: string) => Promise<void>;
    approveMember: (memberId: string) => Promise<void>;
    rejectMember: (memberId: string) => Promise<void>;
    refreshMyGroups: () => Promise<void>;
    subscribeToGroup: (groupId: string, onUpdate: (group: Group | null) => void) => () => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
    const [myGroups, setMyGroups] = useState<string[]>([]);
    const [userId, setUserId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const isGroupsLoaded = React.useRef(false);

    // Groups that still have operations waiting in the outbox. Kept in a ref
    // (besides the queue itself) so subscription callbacks can check it
    // synchronously and avoid overwriting optimistic local changes.
    const pendingGroups = useRef<Set<string>>(new Set());

    // Track active listeners and storageService unsubscribers per groupId
    const groupListeners = React.useRef<Map<string, Set<(group: Group | null) => void>>>(new Map());
    const groupUnsubscribers = React.useRef<Map<string, () => void>>(new Map());

    // Helper to persist myGroups safely
    const persistMyGroups = async (groups: string[]) => {
        try {
            await AsyncStorage.setItem('myGroups', JSON.stringify(groups));
        } catch (e) {
            console.error('[Groups] Failed to persist myGroups:', e);
        }
    };

    // ========== AUTH SETUP ==========
    useEffect(() => {
        const loadStoredUser = async () => {
            try {
                const storedUid = await AsyncStorage.getItem('uid');
                if (storedUid) {
                    console.log('[Auth] Restored user ID from storage:', storedUid);
                    setUserId(storedUid);
                }
            } catch (e) {
                console.error('[Auth] Failed to load stored user ID:', e);
            }
        };
        loadStoredUser();
    }, []);

    useEffect(() => {
        let unsubscribe: () => void;

        const initAuth = async () => {
            // @ts-ignore
            unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    console.log('[Auth] User connected:', user.uid);
                    setUserId(user.uid);
                    await AsyncStorage.setItem('uid', user.uid);
                } else {
                    console.log('[Auth] No user, attempting anonymous sign in');
                    const storedUid = await AsyncStorage.getItem('uid');
                    if (storedUid) {
                        setUserId(storedUid);
                    }

                    try {
                        // @ts-ignore
                        const cred = await signInAnonymously(firebaseAuth);
                        setUserId(cred.user.uid);
                        await AsyncStorage.setItem('uid', cred.user.uid);
                    } catch (error) {
                        console.error('[Auth] Anonymous sign in failed (likely offline):', error);
                    }
                }
            });
        };

        initAuth();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // ========== MY GROUPS MANAGEMENT ==========
    const refreshMyGroups = async (groupsToCheck?: string[]) => {
        try {
            const json = await AsyncStorage.getItem('myGroups');
            const savedGroups: string[] = json ? JSON.parse(json) : [];
            const localGroups = await LocalGroupStore.getAllGroups();
            const localGroupIds = Object.keys(localGroups);
            const sourceGroups = groupsToCheck || Array.from(new Set([...savedGroups, ...localGroupIds, ...myGroups]));

            if (sourceGroups.length === 0) {
                setMyGroups([]);
                return;
            }

            console.log('[Sync] Validating myGroups against server...', sourceGroups);
            const validGroupIds: string[] = [];

            for (const gId of sourceGroups) {
                const hasPendingOperations =
                    pendingGroups.current.has(gId) ||
                    await OperationQueue.hasPendingForGroup(gId) ||
                    await LocalGroupStore.isDirty(gId);

                if (hasPendingOperations) {
                    // Group has pending local operations, retain it
                    validGroupIds.push(gId);
                    continue;
                }

                try {
                    const serverGroup = await storageService.getGroup(gId);
                    if (serverGroup) {
                        validGroupIds.push(gId);
                        await LocalGroupStore.saveGroup(serverGroup);
                    } else {
                        // The group was deleted on the server!
                        console.log(`[Sync] Group ${gId} deleted on server, removing locally.`);
                        await LocalGroupStore.deleteGroup(gId);
                        setCurrentGroup(prev => (prev?.id === gId ? null : prev));
                    }
                } catch (err) {
                    console.log(`[Sync] Could not verify group ${gId} (offline?), keeping local copy:`, err);
                    validGroupIds.push(gId);
                }
            }

            const uniqueValid = Array.from(new Set(validGroupIds));
            setMyGroups(uniqueValid);
            await persistMyGroups(uniqueValid);
        } catch (error) {
            console.error('[Sync] Error refreshing myGroups:', error);
        }
    };

    useEffect(() => {
        if (!userId) return;

        const loadGroups = async () => {
            try {
                const json = await AsyncStorage.getItem('myGroups');
                const savedGroups: string[] = json ? JSON.parse(json) : [];

                // Check LocalGroupStore to avoid losing locally saved or joined groups
                const localGroups = await LocalGroupStore.getAllGroups();
                const localGroupIds = Object.keys(localGroups);
                const mergedGroupIds = Array.from(new Set([...savedGroups, ...localGroupIds]));

                setMyGroups(mergedGroupIds);
                isGroupsLoaded.current = true;
                await persistMyGroups(mergedGroupIds);

                // Reconcile and validate myGroups against server
                refreshMyGroups(mergedGroupIds);
            } catch (error) {
                console.error('[Groups] Failed to load myGroups:', error);
            }
        };

        loadGroups();
    }, [userId]);

    useEffect(() => {
        if (!isGroupsLoaded.current || !userId) return;
        persistMyGroups(myGroups);
    }, [myGroups, userId]);

    // ========== OPERATION QUEUE (OFFLINE OUTBOX) ==========
    const processor = useRef<OperationProcessor | null>(null);
    if (!processor.current) {
        processor.current = new OperationProcessor(storageService);
    }

    const refreshPendingGroups = useCallback(async () => {
        const operations = await OperationQueue.getAll();
        pendingGroups.current = new Set(operations.map(operation => operation.groupId));
    }, []);

    const processQueue = useCallback(async () => {
        try {
            await processor.current?.processAll();
        } catch (error) {
            console.error('[Operations] Failed to process queue:', error);
        } finally {
            await refreshPendingGroups();
        }
    }, [refreshPendingGroups]);

    const enqueueOperation = useCallback(async (operation: NewOperation) => {
        // Mark as pending synchronously so an in-flight server snapshot cannot
        // overwrite the optimistic local change before the queue is persisted.
        pendingGroups.current.add(operation.groupId);

        try {
            await OperationQueue.enqueue(operation);
        } catch (error) {
            console.error('[Operations] Failed to enqueue operation:', error);
        }

        void processQueue();
    }, [processQueue]);

    useEffect(() => {
        if (!userId) return;

        let cancelled = false;

        const start = async () => {
            // Migrate legacy dirty flags into merge operations. A dirty group
            // had local changes that were never confirmed by the server; the
            // merge only adds local data and updates group fields.
            const dirtyGroupIds = await LocalGroupStore.getDirtyGroupIds();
            for (const groupId of dirtyGroupIds) {
                if (cancelled) return;

                const hasPending = await OperationQueue.hasPendingForGroup(groupId);
                if (!hasPending) {
                    await OperationQueue.enqueue({
                        id: `merge-${groupId}`,
                        groupId,
                        type: 'mergeGroup',
                        payload: {}
                    });
                }

                await LocalGroupStore.clearDirty(groupId);
            }

            await refreshPendingGroups();
            await processQueue();
        };

        start().catch(error => {
            console.error('[Operations] Failed to start queue processing:', error);
        });

        const unsubscribeQueue = OperationQueue.subscribe(() => {
            // Only refresh the pending set here. Processing is triggered by
            // enqueue, connectivity changes and foreground transitions, so a
            // failing operation does not cause a retry storm.
            void refreshPendingGroups();
        });

        const unsubscribeNetInfo = NetInfo.addEventListener(state => {
            if (state.isConnected) {
                void processQueue();
            }
        });

        const appStateSubscription = AppState.addEventListener('change', state => {
            if (state === 'active') {
                void processQueue();
            }
        });

        // Safety net for transient failures: retry periodically. processAll is
        // a no-op when the queue is empty, and per-operation backoff prevents
        // hammering a permanently failing write.
        const retryInterval = setInterval(() => {
            void processQueue();
        }, 30_000);

        return () => {
            cancelled = true;
            clearInterval(retryInterval);
            unsubscribeQueue();
            unsubscribeNetInfo();
            appStateSubscription.remove();
        };
    }, [userId, processQueue, refreshPendingGroups]);

    // ========== HELPER: SAVE LOCALLY ==========
    const saveGroupLocally = async (group: Group) => {
        // The local copy is the optimistic view. The outbox records the
        // operation that still has to reach the server.
        await LocalGroupStore.saveGroup(group);
    };

    // ========== HELPER: ADD TO MY GROUPS ==========
    const addToMyGroups = (groupId: string) => {
        setMyGroups(prev => {
            if (prev.includes(groupId)) return prev;
            const updated = [...prev, groupId];
            persistMyGroups(updated);
            return updated;
        });
    };

    // ========== CREATE GROUP ==========
    const createGroup = async (name: string, userName: string) => {
        if (!userId) {
            alert("Erro: Usuário não autenticado. Tente reiniciar o app.");
            return '';
        }

        setIsLoading(true);

        try {
            const newGroupId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            const now = Date.now();

            const newGroup: Group = {
                id: newGroupId,
                name: name,
                ownerId: userId,
                createdAt: now,
                updatedAt: now,
                version: 1,
                members: [{
                    id: userId,
                    name: userName,
                    status: 'active'
                }],
                expenses: []
            };

            // Save locally first. Mark pending before the write so a snapshot
            // arriving during AsyncStorage I/O cannot overwrite it.
            pendingGroups.current.add(newGroupId);
            await saveGroupLocally(newGroup);

            // Update UI immediately
            setCurrentGroup(newGroup);
            addToMyGroups(newGroupId);

            await enqueueOperation({
                id: `create-${newGroupId}`,
                groupId: newGroupId,
                type: 'createGroup',
                payload: {}
            });

            console.log(`[CreateGroup] Created group ${newGroupId} locally`);
            return newGroupId;

        } catch (error: any) {
            console.error("[CreateGroup] Error:", error);
            alert(`Error creating group: ${error.message}`);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // ========== GET GROUP ==========
    const getGroup = async (groupId: string): Promise<Group | null> => {
        // Always load from local storage first
        const localGroup = await LocalGroupStore.getGroup(groupId);
        if (localGroup) {
            console.log(`[GetGroup] Loaded group ${groupId} from local storage`);
            return localGroup;
        }

        // If not local, try to fetch from server
        try {
            const serverGroup = await storageService.getGroup(groupId);
            if (serverGroup) {
                // Save to local storage for future offline access
                await LocalGroupStore.saveGroup(serverGroup);
                console.log(`[GetGroup] Fetched group ${groupId} from server`);
                return serverGroup;
            }
        } catch (error) {
            console.error(`[GetGroup] Failed to fetch group ${groupId}:`, error);
        }

        return null;
    };

    // ========== JOIN GROUP ==========
    const joinGroup = async (groupId: string, userName?: string) => {
        if (!userId) return { success: false, status: 'error' as const };
        setIsLoading(true);

        try {
            // Load from local first
            let group = await getGroup(groupId);

            if (!group) {
                return { success: false, status: 'group_not_found' as const };
            }

            // Check if already a member
            const existingMember = group.members.find(m => m.id === userId);
            if (existingMember) {
                setCurrentGroup(group);
                addToMyGroups(group.id);

                // Subscribe to updates
                subscribeToGroup(groupId, (updated) => {
                    if (updated) {
                        setCurrentGroup(updated);
                    }
                });

                return {
                    success: false,
                    status: 'already_member' as const,
                    memberName: existingMember.name
                };
            }

            // If userName provided, add as member
            if (userName) {
                const pendingMember: Member = { id: userId, name: userName, status: 'pending' };

                group = {
                    ...group,
                    members: [...group.members, pendingMember],
                    updatedAt: Date.now()
                };

                pendingGroups.current.add(groupId);
                await LocalGroupStore.saveGroup(group);
                setCurrentGroup(group);

                await enqueueOperation({
                    id: `join-${groupId}-${userId}`,
                    groupId,
                    type: 'addMember',
                    payload: pendingMember
                });
            } else {
                setCurrentGroup(group);
            }

            addToMyGroups(group.id);

            // Subscribe to updates
            subscribeToGroup(groupId, (updated) => {
                if (updated) {
                    setCurrentGroup(updated);
                }
            });

            return { success: true, status: 'joined' as const };
        } catch (error) {
            console.error("[JoinGroup] Error:", error);
            return { success: false, status: 'error' as const };
        } finally {
            setIsLoading(false);
        }
    };

    // ========== SUBSCRIBE TO GROUP ==========
    const subscribeToGroup = (groupId: string, onUpdate: (group: Group | null) => void) => {
        // Register listener
        if (!groupListeners.current.has(groupId)) {
            groupListeners.current.set(groupId, new Set());
        }
        groupListeners.current.get(groupId)!.add(onUpdate);

        // If not already subscribed to backend storageService for this group, subscribe
        if (!groupUnsubscribers.current.has(groupId)) {
            const unsubscribe = storageService.subscribeToGroup(groupId, async (serverGroup) => {
                if (!serverGroup) {
                    console.log(`[Subscribe] Group ${groupId} does not exist on server (deleted)`);
                    const hasPendingChanges =
                        pendingGroups.current.has(groupId) ||
                        await OperationQueue.hasPendingForGroup(groupId) ||
                        await LocalGroupStore.isDirty(groupId);

                    if (hasPendingChanges) {
                        console.log(`[Subscribe] Group ${groupId} has pending operations, keeping local copy`);
                        return;
                    }

                    // Remove deleted group locally
                    await LocalGroupStore.deleteGroup(groupId);
                    setMyGroups(prev => {
                        const next = prev.filter(id => id !== groupId);
                        persistMyGroups(next);
                        return next;
                    });
                    setCurrentGroup(prev => (prev?.id === groupId ? null : prev));

                    // Notify all listeners of deletion
                    const listeners = groupListeners.current.get(groupId);
                    if (listeners) {
                        listeners.forEach(cb => cb(null));
                    }
                    return;
                }

                // Group exists on server
                const hasPendingChanges =
                    pendingGroups.current.has(groupId) ||
                    await OperationQueue.hasPendingForGroup(groupId) ||
                    await LocalGroupStore.isDirty(groupId);
                let groupToDispatch = serverGroup;

                if (hasPendingChanges) {
                    console.log(`[Subscribe] Group ${groupId} has pending operations, keeping local changes`);
                    const localGroup = await LocalGroupStore.getGroup(groupId);
                    if (localGroup) {
                        groupToDispatch = localGroup;
                    }
                } else {
                    console.log(`[Subscribe] Updating group ${groupId} from server`);
                    await LocalGroupStore.saveGroup(serverGroup);
                }

                // Always update currentGroup if this is the active group
                setCurrentGroup(prev => (prev?.id === groupId ? groupToDispatch : prev));

                // Notify all listeners
                const listeners = groupListeners.current.get(groupId);
                if (listeners) {
                    listeners.forEach(cb => cb(groupToDispatch));
                }
            });

            groupUnsubscribers.current.set(groupId, unsubscribe);
        }

        // Return unsubscribe function for this specific listener
        return () => {
            const listeners = groupListeners.current.get(groupId);
            if (listeners) {
                listeners.delete(onUpdate);
                if (listeners.size === 0) {
                    groupListeners.current.delete(groupId);
                    const backendUnsub = groupUnsubscribers.current.get(groupId);
                    if (backendUnsub) {
                        backendUnsub();
                        groupUnsubscribers.current.delete(groupId);
                    }
                }
            }
        };
    };

    // ========== ADD EXPENSE ==========
    const addExpense = async (title: string, amount: number, paidBy: string, splitAmong: string[], date: number = Date.now()) => {
        if (!currentGroup) return;

        const newExpense: Expense = {
            id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            title,
            amount,
            paidBy,
            splitAmong,
            date,
            createdAt: Date.now(),
            createdBy: userId || 'offline-user'
        };

        const updatedGroup = {
            ...currentGroup,
            expenses: [...currentGroup.expenses, newExpense],
            updatedAt: Date.now()
        };

        // Save locally and enqueue the server write
        pendingGroups.current.add(currentGroup.id);
        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);

        await enqueueOperation({
            id: makeOperationId('expense-add'),
            groupId: currentGroup.id,
            type: 'addExpense',
            payload: newExpense
        });

        console.log(`[AddExpense] Added expense "${title}" to group ${currentGroup.id}`);
    };

    // ========== ADD MEMBER ==========
    const addMember = async (name: string) => {
        if (!currentGroup) return;

        const newMember: Member = {
            id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            name,
            status: 'active'
        };

        const updatedGroup = {
            ...currentGroup,
            members: [...currentGroup.members, newMember],
            updatedAt: Date.now()
        };

        // Save locally and enqueue the server write
        pendingGroups.current.add(currentGroup.id);
        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);

        await enqueueOperation({
            id: makeOperationId('member-add'),
            groupId: currentGroup.id,
            type: 'addMember',
            payload: newMember
        });

        console.log(`[AddMember] Added member "${name}" to group ${currentGroup.id}`);
    };

    // ========== REMOVE MEMBER ==========
    const removeMember = async (memberId: string) => {
        if (!currentGroup) return;
        if (currentGroup.ownerId === memberId) {
            alert(i18n.t('cannotRemoveCreator'));
            return;
        }

        const updatedGroup = {
            ...currentGroup,
            members: currentGroup.members.filter(m => m.id !== memberId),
            updatedAt: Date.now()
        };

        pendingGroups.current.add(currentGroup.id);
        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);

        await enqueueOperation({
            id: makeOperationId('member-remove'),
            groupId: currentGroup.id,
            type: 'removeMember',
            payload: { memberId }
        });
    };

    // ========== DELETE EXPENSE ==========
    const deleteExpense = async (expenseId: string) => {
        if (!currentGroup) return;

        const updatedGroup = {
            ...currentGroup,
            expenses: currentGroup.expenses.filter(e => e.id !== expenseId),
            updatedAt: Date.now()
        };

        pendingGroups.current.add(currentGroup.id);
        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);

        await enqueueOperation({
            id: makeOperationId('expense-delete'),
            groupId: currentGroup.id,
            type: 'deleteExpense',
            payload: { expenseId }
        });
    };

    // ========== DELETE GROUP ==========
    const deleteGroup = async () => {
        if (!currentGroup) return;
        const groupId = currentGroup.id;

        // Drop everything that was still pending for this group; the delete
        // supersedes any previous operation. Mark it pending synchronously so
        // an in-flight snapshot cannot resurrect the local copy.
        pendingGroups.current.add(groupId);
        await OperationQueue.removeGroup(groupId);
        await LocalGroupStore.deleteGroup(groupId);

        setMyGroups(prev => {
            const next = prev.filter(id => id !== groupId);
            persistMyGroups(next);
            return next;
        });
        setCurrentGroup(null);

        await enqueueOperation({
            id: `delete-${groupId}`,
            groupId,
            type: 'deleteGroup',
            payload: {}
        });
    };

    // ========== UPDATE GROUP IMAGE ==========
    const updateGroupImage = async (uri: string) => {
        if (!currentGroup) return;
        const groupId = currentGroup.id;

        // Save locally with the URI immediately
        const updatedGroup = {
            ...currentGroup,
            imageUrl: uri,
            updatedAt: Date.now()
        };

        pendingGroups.current.add(groupId);
        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);

        const queueImageUpdate = async (imageUrl: string) => {
            await enqueueOperation({
                id: `update-${groupId}`,
                groupId,
                type: 'updateGroup',
                payload: { imageUrl }
            });
        };

        console.log(`[UpdateImage] Saved image locally for group ${groupId}`);

        // If it's a local file URI, try to upload in background
        if (uri.startsWith('file://') || uri.startsWith('data:')) {
            const performUpload = async () => {
                try {
                    const path = `groups/${groupId}/image_${Date.now()}`;
                    const downloadUrl = await storageService.uploadImage(uri, path);

                    console.log(`[UpdateImage] Uploaded image, got URL: ${downloadUrl}`);

                    // Update with remote URL
                    const finalGroup = {
                        ...updatedGroup,
                        imageUrl: downloadUrl,
                        updatedAt: Date.now()
                    };

                    await saveGroupLocally(finalGroup);
                    setCurrentGroup(finalGroup);
                    await queueImageUpdate(downloadUrl);
                } catch (error) {
                    console.error("[UpdateImage] Upload failed, keeping local URI:", error);
                    // Keep the local URI. The upload is retried only on a new
                    // selection, since a local file URI cannot be uploaded by
                    // another device.
                    void refreshPendingGroups();
                }
            };

            performUpload();
        } else {
            await queueImageUpdate(uri);
        }
    };

    // ========== APPROVE MEMBER ==========
    const approveMember = async (memberId: string) => {
        if (!currentGroup) return;

        // Apply optimistically and enqueue. The operation is retried when the
        // device reconnects, so approving works offline too.
        const updatedGroup = {
            ...currentGroup,
            members: currentGroup.members.map(m =>
                m.id === memberId ? { ...m, status: 'active' as const } : m
            ),
            updatedAt: Date.now()
        };

        pendingGroups.current.add(currentGroup.id);
        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);

        await enqueueOperation({
            id: `status-${currentGroup.id}-${memberId}`,
            groupId: currentGroup.id,
            type: 'updateMemberStatus',
            payload: { memberId, status: 'active' }
        });

        console.log(`[ApproveMember] Queued approval for member ${memberId}`);
    };

    // ========== REJECT MEMBER ==========
    const rejectMember = async (memberId: string) => {
        if (!currentGroup) return;
        await removeMember(memberId);
    };

    return (
        <GroupContext.Provider value={{
            currentGroup,
            myGroups,
            isLoading,
            userId,
            createGroup,
            getGroup,
            joinGroup,
            addExpense,
            addMember,
            removeMember,
            deleteExpense,
            deleteGroup,
            updateGroupImage,
            approveMember,
            rejectMember,
            refreshMyGroups,
            subscribeToGroup
        }}>
            {children}
        </GroupContext.Provider>
    );
};

export const useGroup = () => {
    const context = useContext(GroupContext);
    if (!context) throw new Error("useGroup must be used within a GroupProvider");
    return context;
};
