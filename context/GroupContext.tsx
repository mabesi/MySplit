
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Group, Expense, Member } from '../types';
import { StorageService } from '../services/StorageInterface';
import { FirebaseService } from '../services/FirebaseService';
import { MockService } from '../services/MockService';
import { LocalGroupStore } from '../services/LocalGroupStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import { auth as firebaseAuth } from '../firebaseConfig';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import i18n from '../i18n/translations';

const USE_MOCK = false;
const storageService: StorageService = USE_MOCK ? new MockService() : new FirebaseService();

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
    subscribeToGroup: (groupId: string, onUpdate: (group: Group) => void) => () => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
    const [myGroups, setMyGroups] = useState<string[]>([]);
    const [userId, setUserId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [dirtyGroups, setDirtyGroups] = useState<Set<string>>(new Set());

    // Track active subscriptions to avoid duplicates
    const activeSubscriptions = React.useRef<Map<string, () => void>>(new Map());

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
    useEffect(() => {
        if (!userId) return;

        const loadGroups = async () => {
            try {
                const json = await AsyncStorage.getItem('myGroups');
                const savedGroups: string[] = json ? JSON.parse(json) : [];
                setMyGroups(savedGroups);
            } catch (error) {
                console.error('[Groups] Failed to load myGroups:', error);
            }
        };

        loadGroups();
    }, [userId]);

    useEffect(() => {
        if (userId) {
            AsyncStorage.setItem('myGroups', JSON.stringify(myGroups));
        }
    }, [myGroups, userId]);

    // ========== BACKGROUND SYNC ==========
    useEffect(() => {
        if (!userId || dirtyGroups.size === 0) return;

        const syncDirtyGroups = async () => {
            console.log(`[Sync] Syncing ${dirtyGroups.size} dirty groups...`);

            for (const groupId of Array.from(dirtyGroups)) {
                try {
                    const localGroup = await LocalGroupStore.getGroup(groupId);
                    if (!localGroup) {
                        console.warn(`[Sync] Group ${groupId} not found locally, clearing dirty flag`);
                        await LocalGroupStore.clearDirty(groupId);
                        setDirtyGroups(prev => {
                            const next = new Set(prev);
                            next.delete(groupId);
                            return next;
                        });
                        continue;
                    }

                    // Check if group exists on server
                    let serverGroup;
                    try {
                        serverGroup = await storageService.getGroup(groupId);
                    } catch (error) {
                        console.log(`[Sync] Could not fetch group ${groupId} from server:`, error);
                    }

                    if (!serverGroup) {
                        // Group doesn't exist on server, create it
                        console.log(`[Sync] Creating new group ${groupId} on server`);
                        const owner = localGroup.members.find(m => m.id === localGroup.ownerId);
                        if (owner) {
                            await storageService.createGroup(
                                localGroup.name,
                                { id: owner.id, name: owner.name, email: owner.email },
                                localGroup.id
                            );
                        }
                    } else {
                        // Group exists, update it
                        console.log(`[Sync] Updating existing group ${groupId} on server`);

                        // Update members
                        for (const member of localGroup.members) {
                            const existsOnServer = serverGroup.members.some(m => m.id === member.id);
                            if (!existsOnServer) {
                                await storageService.addMember(groupId, member);
                            }
                        }

                        // Update expenses
                        for (const expense of localGroup.expenses) {
                            const existsOnServer = serverGroup.expenses.some(e => e.id === expense.id);
                            if (!existsOnServer) {
                                await storageService.addExpense(groupId, expense);
                            }
                        }

                        // Update group fields (name, imageUrl, etc.)
                        const updates: Partial<Group> = {};
                        if (localGroup.name !== serverGroup.name) updates.name = localGroup.name;
                        if (localGroup.imageUrl !== serverGroup.imageUrl) updates.imageUrl = localGroup.imageUrl;

                        if (Object.keys(updates).length > 0) {
                            await storageService.updateGroup(groupId, updates);
                        }
                    }

                    // Verify sync with metadata
                    const metadata = await storageService.getGroupMetadata(groupId);
                    if (metadata && !metadata.hasPendingWrites) {
                        console.log(`[Sync] Group ${groupId} synced successfully`);
                        await LocalGroupStore.clearDirty(groupId);
                        setDirtyGroups(prev => {
                            const next = new Set(prev);
                            next.delete(groupId);
                            return next;
                        });
                    } else {
                        console.log(`[Sync] Group ${groupId} still has pending writes`);
                    }
                } catch (error) {
                    console.error(`[Sync] Failed to sync group ${groupId}:`, error);
                }
            }
        };

        const timer = setTimeout(syncDirtyGroups, 2000);
        return () => clearTimeout(timer);
    }, [dirtyGroups, userId]);

    // ========== HELPER: SAVE AND MARK DIRTY ==========
    const saveGroupLocally = async (group: Group) => {
        await LocalGroupStore.saveGroup(group);
        await LocalGroupStore.markDirty(group.id);
        setDirtyGroups(prev => new Set(prev).add(group.id));
    };

    // ========== HELPER: ADD TO MY GROUPS ==========
    const addToMyGroups = (groupId: string) => {
        if (!myGroups.includes(groupId)) {
            setMyGroups(prev => [...prev, groupId]);
        }
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

            // Save locally first
            await saveGroupLocally(newGroup);

            // Update UI immediately
            setCurrentGroup(newGroup);
            addToMyGroups(newGroupId);

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
                    setCurrentGroup(updated);
                });

                return {
                    success: false,
                    status: 'already_member' as const,
                    memberName: existingMember.name
                };
            }

            // If userName provided, add as member
            if (userName) {
                try {
                    await storageService.addMember(groupId, { id: userId, name: userName, status: 'pending' });

                    // Reload group to get updated state
                    group = await storageService.getGroup(groupId) || group;
                    await LocalGroupStore.saveGroup(group);
                    setCurrentGroup(group);
                } catch (e: any) {
                    if (e.message === 'Name taken') {
                        return { success: false, status: 'name_taken' as const };
                    }
                    throw e;
                }
            } else {
                setCurrentGroup(group);
            }

            addToMyGroups(group.id);

            // Subscribe to updates
            subscribeToGroup(groupId, (updated) => {
                setCurrentGroup(updated);
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
    const subscribeToGroup = (groupId: string, onUpdate: (group: Group) => void) => {
        // Avoid duplicate subscriptions
        if (activeSubscriptions.current.has(groupId)) {
            console.log(`[Subscribe] Already subscribed to ${groupId}`);
            return activeSubscriptions.current.get(groupId)!;
        }

        const unsubscribe = storageService.subscribeToGroup(groupId, async (serverGroup) => {
            // Check if we have local changes
            const isDirty = await LocalGroupStore.isDirty(groupId);

            if (isDirty) {
                // We have local changes, don't overwrite with server data
                console.log(`[Subscribe] Group ${groupId} is dirty, keeping local changes`);
                const localGroup = await LocalGroupStore.getGroup(groupId);
                if (localGroup) {
                    onUpdate(localGroup);
                }
            } else {
                // No local changes, accept server update
                console.log(`[Subscribe] Updating group ${groupId} from server`);
                await LocalGroupStore.saveGroup(serverGroup);
                onUpdate(serverGroup);
            }
        });

        activeSubscriptions.current.set(groupId, unsubscribe);

        return () => {
            unsubscribe();
            activeSubscriptions.current.delete(groupId);
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

        // Save locally and mark dirty
        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);

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

        // Save locally and mark dirty
        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);

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

        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);
    };

    // ========== DELETE EXPENSE ==========
    const deleteExpense = async (expenseId: string) => {
        if (!currentGroup) return;

        const updatedGroup = {
            ...currentGroup,
            expenses: currentGroup.expenses.filter(e => e.id !== expenseId),
            updatedAt: Date.now()
        };

        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);
    };

    // ========== DELETE GROUP ==========
    const deleteGroup = async () => {
        if (!currentGroup) return;
        const groupId = currentGroup.id;

        try {
            await storageService.deleteGroup(groupId);
        } catch (error) {
            console.error('[DeleteGroup] Failed to delete from server:', error);
        }

        await LocalGroupStore.deleteGroup(groupId);
        setMyGroups(prev => prev.filter(id => id !== groupId));
        setCurrentGroup(null);
        setDirtyGroups(prev => {
            const next = new Set(prev);
            next.delete(groupId);
            return next;
        });
    };

    // ========== UPDATE GROUP IMAGE ==========
    const updateGroupImage = async (uri: string) => {
        if (!currentGroup) return;

        // Save locally with the URI immediately
        const updatedGroup = {
            ...currentGroup,
            imageUrl: uri,
            updatedAt: Date.now()
        };

        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);

        console.log(`[UpdateImage] Saved image locally for group ${currentGroup.id}`);

        // If it's a local file URI, try to upload in background
        if (uri.startsWith('file://') || uri.startsWith('data:')) {
            const performUpload = async () => {
                try {
                    const path = `groups/${currentGroup.id}/image_${Date.now()}`;
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
                } catch (error) {
                    console.error("[UpdateImage] Upload failed, keeping local URI:", error);
                    // Keep the local URI - sync will handle it later
                }
            };

            performUpload();
        }
    };

    // ========== APPROVE MEMBER ==========
    const approveMember = async (memberId: string) => {
        if (!currentGroup) return;

        const updatedGroup = {
            ...currentGroup,
            members: currentGroup.members.map(m =>
                m.id === memberId ? { ...m, status: 'active' as const } : m
            ),
            updatedAt: Date.now()
        };

        await saveGroupLocally(updatedGroup);
        setCurrentGroup(updatedGroup);
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
