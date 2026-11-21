import { logger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group } from '../types';
import { withMemberIds } from '../utils/memberLogic';

/**
 * LocalGroupStore - Handles atomic local persistence of groups
 * This is the single source of truth for offline data
 */
export class LocalGroupStore {
    private static GROUPS_KEY = 'local_groups';
    private static DIRTY_KEY = 'dirty_groups';

    // Serialize read-modify-write operations. Without this, two concurrent
    // saveGroup calls (e.g. an optimistic mutation and an incoming snapshot)
    // can read the same map and one overwrites the other.
    private static writeChain: Promise<unknown> = Promise.resolve();

    private static enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.writeChain.then(operation, operation);
        this.writeChain = result.then(
            () => undefined,
            () => undefined
        );
        return result;
    }

    /**
     * Save a group to local storage
     */
    static saveGroup(group: Group): Promise<void> {
        return this.enqueueWrite(async () => {
            try {
                const groupsJson = await AsyncStorage.getItem(this.GROUPS_KEY);
                const groups: Record<string, Group> = groupsJson ? JSON.parse(groupsJson) : {};

                groups[group.id] = withMemberIds(group);

                await AsyncStorage.setItem(this.GROUPS_KEY, JSON.stringify(groups));
                logger.debug(`[LocalStore] Saved group ${group.id}`);
            } catch (error) {
                logger.error('[LocalStore] Failed to save group:', error);
                throw error;
            }
        });
    }

    /**
     * Get a group from local storage
     */
    static async getGroup(groupId: string): Promise<Group | null> {
        try {
            const groupsJson = await AsyncStorage.getItem(this.GROUPS_KEY);
            if (!groupsJson) return null;

            const groups: Record<string, Group> = JSON.parse(groupsJson);
            const group = groups[groupId];
            return group ? withMemberIds(group) : null;
        } catch (error) {
            logger.error('[LocalStore] Failed to get group:', error);
            return null;
        }
    }

    /**
     * Get all groups from local storage
     */
    static async getAllGroups(): Promise<Record<string, Group>> {
        try {
            const groupsJson = await AsyncStorage.getItem(this.GROUPS_KEY);
            if (!groupsJson) return {};
            const groups: Record<string, Group> = JSON.parse(groupsJson);
            const normalized: Record<string, Group> = {};
            Object.keys(groups).forEach(id => {
                normalized[id] = withMemberIds(groups[id]);
            });
            return normalized;
        } catch (error) {
            logger.error('[LocalStore] Failed to get all groups:', error);
            return {};
        }
    }

    /**
     * Mark a group as dirty (needs syncing)
     */
    static markDirty(groupId: string): Promise<void> {
        return this.enqueueWrite(async () => {
            try {
                const dirtyJson = await AsyncStorage.getItem(this.DIRTY_KEY);
                const dirtySet: string[] = dirtyJson ? JSON.parse(dirtyJson) : [];

                if (!dirtySet.includes(groupId)) {
                    dirtySet.push(groupId);
                    await AsyncStorage.setItem(this.DIRTY_KEY, JSON.stringify(dirtySet));
                    logger.debug(`[LocalStore] Marked group ${groupId} as dirty`);
                }
            } catch (error) {
                logger.error('[LocalStore] Failed to mark dirty:', error);
            }
        });
    }

    /**
     * Clear dirty flag for a group
     */
    static clearDirty(groupId: string): Promise<void> {
        return this.enqueueWrite(async () => {
            try {
                await this.writeDirtyWithoutLock(groupId);
            } catch (error) {
                logger.error('[LocalStore] Failed to clear dirty:', error);
            }
        });
    }

    private static async writeDirtyWithoutLock(groupId: string): Promise<void> {
        const dirtyJson = await AsyncStorage.getItem(this.DIRTY_KEY);
        const dirtySet: string[] = dirtyJson ? JSON.parse(dirtyJson) : [];

        const filtered = dirtySet.filter(id => id !== groupId);
        await AsyncStorage.setItem(this.DIRTY_KEY, JSON.stringify(filtered));
        logger.debug(`[LocalStore] Cleared dirty flag for group ${groupId}`);
    }

    /**
     * Get all dirty group IDs
     */
    static async getDirtyGroupIds(): Promise<string[]> {
        try {
            const dirtyJson = await AsyncStorage.getItem(this.DIRTY_KEY);
            return dirtyJson ? JSON.parse(dirtyJson) : [];
        } catch (error) {
            logger.error('[LocalStore] Failed to get dirty groups:', error);
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
    static deleteGroup(groupId: string): Promise<void> {
        return this.enqueueWrite(async () => {
            try {
                const groupsJson = await AsyncStorage.getItem(this.GROUPS_KEY);
                if (groupsJson) {
                    const groups: Record<string, Group> = JSON.parse(groupsJson);
                    delete groups[groupId];
                    await AsyncStorage.setItem(this.GROUPS_KEY, JSON.stringify(groups));
                }

                await this.writeDirtyWithoutLock(groupId);
                logger.debug(`[LocalStore] Deleted group ${groupId}`);
            } catch (error) {
                logger.error('[LocalStore] Failed to delete group:', error);
            }
        });
    }
}
