import { useGroup } from '../context/GroupContext';
import type { SyncStatus } from '../utils/sync';

export type { SyncStatus } from '../utils/sync';

/**
 * Reads the sync status of a group from the existing GroupContext
 * subscription. The context already receives the Firestore snapshot metadata,
 * so this hook no longer opens a second listener per group.
 */
export function useSyncStatus(groupId: string | null): SyncStatus {
    const { getSyncStatus } = useGroup();
    return groupId ? getSyncStatus(groupId) : 'offline';
}
