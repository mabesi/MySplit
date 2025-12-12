import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SyncStatus } from '../hooks/useSyncStatus';
import i18n from '../i18n/translations';

interface SyncIndicatorProps {
    status: SyncStatus;
    variant?: 'badge' | 'icon' | 'text';
    size?: 'small' | 'medium' | 'large';
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
    status,
    variant = 'badge',
    size = 'small'
}) => {
    const config = {
        synced: {
            color: '#10B981', // green
            icon: 'check-circle' as const,
            text: i18n.t('synced') || 'Synced',
            label: '●'
        },
        pending: {
            color: '#F59E0B', // amber
            icon: 'sync' as const,
            text: i18n.t('syncing') || 'Syncing...',
            label: '⟳'
        },
        offline: {
            color: '#6B7280', // gray
            icon: 'cloud-off' as const,
            text: i18n.t('offline') || 'Offline',
            label: '○'
        }
    };

    const current = config[status];
    const sizeMap = { small: 16, medium: 20, large: 24 };
    const iconSize = sizeMap[size];

    if (variant === 'badge') {
        return (
            <View style={[styles.badge, { backgroundColor: current.color }]} />
        );
    }

    if (variant === 'icon') {
        return (
            <MaterialIcons
                name={current.icon}
                size={iconSize}
                color={current.color}
            />
        );
    }

    // variant === 'text'
    return (
        <View style={styles.textContainer}>
            <View style={[styles.dot, { backgroundColor: current.color }]} />
            <Text style={[styles.text, { fontSize: iconSize * 0.75 }]}>
                {current.text}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    textContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    text: {
        color: '#E5E7EB',
        fontWeight: '500',
    },
});
