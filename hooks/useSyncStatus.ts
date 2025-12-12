import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type SyncStatus = 'synced' | 'pending' | 'offline';

export function useSyncStatus(groupId: string | null): SyncStatus {
    const [status, setStatus] = useState<SyncStatus>('synced');
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!groupId) {
            setStatus('offline');
            return;
        }

        // Add a small delay to avoid interfering with initial group load
        const timeoutId = setTimeout(() => {
            try {
                unsubscribeRef.current = onSnapshot(
                    doc(db, 'groups', groupId),
                    { includeMetadataChanges: true },
                    (snapshot) => {
                        // Only update status if document exists
                        if (!snapshot.exists()) {
                            // Don't change status if group doesn't exist yet
                            return;
                        }

                        if (snapshot.metadata.hasPendingWrites) {
                            setStatus('pending');
                        } else if (snapshot.metadata.fromCache) {
                            setStatus('offline');
                        } else {
                            setStatus('synced');
                        }
                    },
                    (error) => {
                        console.error('Sync status error:', error);
                        setStatus('offline');
                    }
                );
            } catch (error) {
                console.error('Failed to create sync status listener:', error);
                setStatus('offline');
            }
        }, 100); // Small delay to let group load first

        return () => {
            clearTimeout(timeoutId);
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [groupId]);

    return status;
}
