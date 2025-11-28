import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Image, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import i18n from '../i18n/translations';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { useRewardedAd } from '../hooks/useRewardedAd';

export default function DonateScreen() {
    const router = useRouter();
    const { loaded, rewardReceived, showAd, resetReward } = useRewardedAd();

    const handleDonate = () => {
        Linking.openURL(`${process.env.EXPO_PUBLIC_BASE_URL}/donate`);
    };

    const handleWatchAd = () => {
        if (loaded) {
            showAd();
        } else {
            // Fallback: if ad didn't load, still show thank you message
            Alert.alert(
                i18n.t('success'),
                i18n.t('adThankYou') + '\n\n(Ad could not be loaded, but thank you for your support!)',
                [{ text: 'OK' }]
            );
        }
    };

    useEffect(() => {
        if (rewardReceived) {
            Alert.alert(
                i18n.t('success'),
                i18n.t('adThankYou'),
                [{
                    text: 'OK',
                    onPress: () => {
                        // Reset reward state after user dismisses alert
                        if (resetReward) resetReward();
                    }
                }]
            );
        }
    }, [rewardReceived, resetReward]);

    return (
        <ScreenWrapper>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{i18n.t('supportDev')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="heart" size={80} color="#F43F5E" />
                </View>

                <Text style={styles.title}>{i18n.t('supportDev')}</Text>

                <Text style={styles.message}>
                    {i18n.t('donationMsg')}
                </Text>

                <TouchableOpacity style={styles.donateButton} onPress={handleDonate}>
                    <LinearGradient
                        colors={['#F43F5E', '#E11D48']}
                        style={styles.gradientButton}
                    >
                        <Ionicons name="heart" size={24} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.donateButtonText}>{i18n.t('donate')}</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.separator}>
                    <View style={styles.separatorLine} />
                    <Text style={styles.separatorText}>{i18n.t('or')}</Text>
                    <View style={styles.separatorLine} />
                </View>

                <TouchableOpacity
                    style={[styles.adButton, !loaded && styles.adButtonDisabled]}
                    onPress={handleWatchAd}
                    disabled={!loaded}
                >
                    <LinearGradient
                        colors={loaded ? ['#10B981', '#059669'] : ['#475569', '#334155']}
                        style={styles.gradientButton}
                    >
                        <Ionicons name="play-circle" size={24} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.adButtonText}>
                            {loaded ? i18n.t('watchAd') : i18n.t('loadingAd')}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F8FAFC',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    iconContainer: {
        marginBottom: 16,
        padding: 20,
        borderRadius: 100,
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#F8FAFC',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    donateButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#F43F5E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    donateButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
        width: '100%',
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#334155',
    },
    separatorText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
        marginHorizontal: 16,
    },
    adButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    adButtonDisabled: {
        opacity: 0.6,
    },
    adButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
