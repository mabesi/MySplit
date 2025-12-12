import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import NetInfo from '@react-native-community/netinfo';

export type SyncStatus = 'synced' | 'pending' | 'offline';

export function useSyncStatus(groupId: string | null): SyncStatus {
    const [status, setStatus] = useState<SyncStatus>('synced');
    const [isOnline, setIsOnline] = useState(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Monitor network connectivity
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected ?? false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!groupId) {
            setStatus('offline');
            return;
        }

        // If no network, show offline immediately
        if (!isOnline) {
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

                        // Check network status first
                        if (!isOnline) {
                            setStatus('offline');
                            return;
                        }

                        if (snapshot.metadata.hasPendingWrites) {
                            setStatus('pending');
                        } else if (snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
                            // Only show offline if from cache AND no network
                            setStatus(isOnline ? 'synced' : 'offline');
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
    }, [groupId, isOnline]);

    return status;
}
