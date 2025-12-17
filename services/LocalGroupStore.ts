import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group } from '../types';

/**
 * LocalGroupStore - Handles atomic local persistence of groups
 * This is the single source of truth for offline data
 */
export class LocalGroupStore {
    private static GROUPS_KEY = 'local_groups';
    private static DIRTY_KEY = 'dirty_groups';

    /**
     * Save a group to local storage
     */
    static async saveGroup(group: Group): Promise<void> {
        try {
            const groupsJson = await AsyncStorage.getItem(this.GROUPS_KEY);
            const groups: Record<string, Group> = groupsJson ? JSON.parse(groupsJson) : {};

            groups[group.id] = group;

            await AsyncStorage.setItem(this.GROUPS_KEY, JSON.stringify(groups));
            console.log(`[LocalStore] Saved group ${group.id}`);
        } catch (error) {
            console.error('[LocalStore] Failed to save group:', error);
            throw error;
        }
    }

    /**
     * Get a group from local storage
     */
    static async getGroup(groupId: string): Promise<Group | null> {
        try {
            const groupsJson = await AsyncStorage.getItem(this.GROUPS_KEY);
            if (!groupsJson) return null;

            const groups: Record<string, Group> = JSON.parse(groupsJson);
            return groups[groupId] || null;
        } catch (error) {
            console.error('[LocalStore] Failed to get group:', error);
            return null;
        }
    }

    /**
     * Get all groups from local storage
     */
    static async getAllGroups(): Promise<Record<string, Group>> {
        try {
            const groupsJson = await AsyncStorage.getItem(this.GROUPS_KEY);
            return groupsJson ? JSON.parse(groupsJson) : {};
        } catch (error) {
            console.error('[LocalStore] Failed to get all groups:', error);
            return {};
        }
    }

    /**
     * Mark a group as dirty (needs syncing)
     */
    static async markDirty(groupId: string): Promise<void> {
        try {
            const dirtyJson = await AsyncStorage.getItem(this.DIRTY_KEY);
            const dirtySet: string[] = dirtyJson ? JSON.parse(dirtyJson) : [];

            if (!dirtySet.includes(groupId)) {
                dirtySet.push(groupId);
                await AsyncStorage.setItem(this.DIRTY_KEY, JSON.stringify(dirtySet));
                console.log(`[LocalStore] Marked group ${groupId} as dirty`);
            }
        } catch (error) {
            console.error('[LocalStore] Failed to mark dirty:', error);
        }
    }

    /**
     * Clear dirty flag for a group
     */
    static async clearDirty(groupId: string): Promise<void> {
        try {
            const dirtyJson = await AsyncStorage.getItem(this.DIRTY_KEY);
            const dirtySet: string[] = dirtyJson ? JSON.parse(dirtyJson) : [];

            const filtered = dirtySet.filter(id => id !== groupId);
            await AsyncStorage.setItem(this.DIRTY_KEY, JSON.stringify(filtered));
            console.log(`[LocalStore] Cleared dirty flag for group ${groupId}`);
        } catch (error) {
            console.error('[LocalStore] Failed to clear dirty:', error);
        }
    }

    /**
     * Get all dirty group IDs
     */
    static async getDirtyGroupIds(): Promise<string[]> {
        try {
            const dirtyJson = await AsyncStorage.getItem(this.DIRTY_KEY);
            return dirtyJson ? JSON.parse(dirtyJson) : [];
        } catch (error) {
            console.error('[LocalStore] Failed to get dirty groups:', error);
            return [];
        }
    }

    /**
     * Check if a group is dirty
     */
    static async isDirty(groupId: string): Promise<boolean> {
        const dirtyIds = await this.getDirtyGroupIds();
        return dirtyIds.includes(groupId);
    }

    /**
     * Delete a group from local storage
     */
    static async deleteGroup(groupId: string): Promise<void> {
        try {
            const groupsJson = await AsyncStorage.getItem(this.GROUPS_KEY);
            if (!groupsJson) return;

            const groups: Record<string, Group> = JSON.parse(groupsJson);
            delete groups[groupId];

            await AsyncStorage.setItem(this.GROUPS_KEY, JSON.stringify(groups));
            await this.clearDirty(groupId);
            console.log(`[LocalStore] Deleted group ${groupId}`);
        } catch (error) {
            console.error('[LocalStore] Failed to delete group:', error);
        }
    }
}
