/**
 * Shareable sync status type. Kept in a neutral module so both the context and
 * the hooks can use it without creating a circular import.
 */
export type SyncStatus = 'synced' | 'pending' | 'offline';
