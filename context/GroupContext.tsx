
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Group, Expense } from '../types';
import { StorageService } from '../services/StorageInterface';
import { FirebaseService } from '../services/FirebaseService';
import { MockService } from '../services/MockService';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import { auth as firebaseAuth } from '../firebaseConfig';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import i18n from '../i18n/translations';
// Toggle this to switch between Real and Mock
const USE_MOCK = false;

const storageService: StorageService = USE_MOCK ? new MockService() : new FirebaseService();



interface GroupContextType {
    currentGroup: Group | null;
    myGroups: string[]; // List of Group IDs
    userId: string;
    isLoading: boolean;
    createGroup: (name: string, userName: string) => Promise<string>;
    getGroup: (groupId: string) => Promise<Group | null>;
    joinGroup: (groupId: string, userName?: string) => Promise<boolean>;
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

    // @ts-ignore
    // @ts-ignore
    useEffect(() => {
        let unsubscribe: () => void;

        const initAuth = async () => {
            // We wait for the first auth state emission from Firebase
            // @ts-ignore
            unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    // Auth state restored
                    setUserId(user.uid);
                    await AsyncStorage.setItem('uid', user.uid);
                } else {
                    // No active session found
                    // Only if Firebase says "no user" do we check storage or create a new one
                    try {
                        const storedUid = await AsyncStorage.getItem('uid');
                        if (storedUid) {
                            // This is a tricky case: We have a stored UID but Firebase says we are logged out.
                            // For anonymous auth, we can't "re-login" with just a UID. 
                            // We have to accept we might need a new ID, OR the session is just expired.
                            // However, to be safe and avoid stranding data, we'll try to sign in anonymously again.
                            // Ideally, Firebase persistence handles this. If we are here, persistence failed or cleared.
                            // Stored UID exists but Firebase auth is null
                        }

                        // Signing in anonymously...
                        // @ts-ignore
                        const cred = await signInAnonymously(firebaseAuth);
                        const uid = cred.user.uid;
                        // Signed in new anonymous user
                        setUserId(uid);
                        await AsyncStorage.setItem('uid', uid);
                    } catch (error) {
                        console.error('❌ Error during anonymous sign in:', error);
                    }
                }
            });
        };

        initAuth();

        return () => {
            if (unsubscribe) {
                // Cleaning up auth listener
                unsubscribe();
            }
        };
    }, []);

    const [isGroupsLoaded, setIsGroupsLoaded] = useState(false);

    // ... (auth effect)

    // Load myGroups from storage after UID is ready and validate membership
    useEffect(() => {
        if (!userId) {
            // Waiting for userId before loading groups...
            return;
        }
        // Loading groups for UID
        const loadAndValidateGroups = async () => {
            try {
                const json = await AsyncStorage.getItem('myGroups');
                const savedGroups: string[] = json ? JSON.parse(json) : [];
                // Saved groups from storage

                // ... (mock logic omitted)

                const validGroups: string[] = [];
                for (const groupId of savedGroups) {
                    const group = await storageService.getGroup(groupId);
                    if (group) {
                        const isMember = group.members.some(m => m.id === userId);
                        if (isMember) validGroups.push(groupId);
                    }
                }
                // Valid groups
                setMyGroups(validGroups);
                setIsGroupsLoaded(true); // Mark as loaded

                // We don't strictly need to save here if we just loaded it, 
                // but if we filtered out invalid groups, we should update storage.
                if (validGroups.length !== savedGroups.length) {
                    await AsyncStorage.setItem('myGroups', JSON.stringify(validGroups));
                }

            } catch (error) {
                console.error("❌ Failed to load groups", error);
                setIsGroupsLoaded(true); // Even on error, stop blocking saves
            }
        };

        loadAndValidateGroups();
    }, [userId]);

    // Save myGroups whenever it changes, BUT ONLY IF LOADED
    useEffect(() => {
        if (isGroupsLoaded) {
            // Saving myGroups to storage
            AsyncStorage.setItem('myGroups', JSON.stringify(myGroups));
        }
    }, [myGroups, isGroupsLoaded]);

    // Subscribe to updates when a group is loaded, ensuring UI updates for image changes
    useEffect(() => {
        if (currentGroup?.id) {
            const unsubscribe = storageService.subscribeToGroup(currentGroup.id, (updatedGroup) => {
                // Force state update even if only imageUrl changed
                setCurrentGroup(prev => ({ ...prev, ...updatedGroup }));
            });
            return () => {
                // Unsubscribing from group updates
                unsubscribe();
            };
        }
    }, [currentGroup?.id]);

    const addToMyGroups = (groupId: string) => {
        if (!myGroups.includes(groupId)) {
            setMyGroups(prev => [...prev, groupId]);
        }
    };

    const createGroup = async (name: string, userName: string) => {
        if (!userId) return '';
        setIsLoading(true);
        try {
            const group = await storageService.createGroup(name, { id: userId, name: userName });
            setCurrentGroup(group);
            addToMyGroups(group.id);
            return group.id;
        } catch (error: any) {
            console.error("Error creating group:", error);
            alert(`Error creating group: ${error.message} `);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const getGroup = async (groupId: string) => {
        return await storageService.getGroup(groupId);
    };

    const joinGroup = async (groupId: string, userName?: string) => {
        if (!userId) return false;
        setIsLoading(true);
        try {
            const group = await storageService.getGroup(groupId);
            if (group) {
                // If userName provided, add as member (or update if exists)
                if (userName) {
                    try {
                        await storageService.addMember(groupId, { id: userId, name: userName, status: 'pending' });
                    } catch (e: any) {
                        if (e.message === 'Name taken') {
                            alert(i18n.t('nameTaken') || 'Name already taken by another user');
                            return false;
                        }
                        throw e;
                    }
                }

                setCurrentGroup(group);
                addToMyGroups(group.id);
                return true;
            } else {
                alert(i18n.t('groupNotFound'));
                return false;
            }
        } catch (error) {
            console.error("Error joining group:", error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const addExpense = async (title: string, amount: number, paidBy: string, splitAmong: string[], date: number = Date.now()) => {
        if (!currentGroup || !userId) return;
        await storageService.addExpense(currentGroup.id, { title, amount, paidBy, splitAmong, date, createdBy: userId });
    };

    const addMember = async (name: string) => {
        if (!currentGroup) return;
        // Adding a generic member (not self) - generate a random ID for them?
        // Or does this function mean "add ME"? 
        // Usually "addMember" in UI context means adding SOMEONE ELSE manually.
        // If adding someone else, we generate an ID for them.
        const newMemberId = `user - ${Date.now()} -${Math.random().toString(36).substring(2, 9)} `;
        await storageService.addMember(currentGroup.id, { id: newMemberId, name, status: 'active' });
    };

    const removeMember = async (memberId: string) => {
        if (!currentGroup) return;
        if (currentGroup.ownerId === memberId) {
            alert(i18n.t('cannotRemoveCreator'));
            return;
        }
        await storageService.removeMember(currentGroup.id, memberId);
    };

    const deleteExpense = async (expenseId: string) => {
        if (!currentGroup) return;
        await storageService.deleteExpense(currentGroup.id, expenseId);
    };

    const deleteGroup = async () => {
        if (!currentGroup) return;
        const groupId = currentGroup.id;
        await storageService.deleteGroup(groupId);
        // Remove from myGroups
        const updatedGroups = myGroups.filter(id => id !== groupId);
        setMyGroups(updatedGroups);
        await AsyncStorage.setItem('myGroups', JSON.stringify(updatedGroups));
        setCurrentGroup(null);
    };

    const updateGroupImage = async (uri: string) => {
        if (!currentGroup) return;
        setIsLoading(true);
        try {
            // Upload image to storage first
            const path = `groups/${currentGroup.id}/image_${Date.now()}`;
            const downloadUrl = await storageService.uploadImage(uri, path);

            // Update group with download URL
            await storageService.updateGroup(currentGroup.id, { imageUrl: downloadUrl });
        } catch (error) {
            console.error("Error updating group image:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const approveMember = async (memberId: string) => {
        if (!currentGroup) return;
        await storageService.updateMemberStatus(currentGroup.id, memberId, 'active');
    };

    const rejectMember = async (memberId: string) => {
        if (!currentGroup) return;
        await storageService.removeMember(currentGroup.id, memberId);
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
            subscribeToGroup: storageService.subscribeToGroup.bind(storageService)
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
