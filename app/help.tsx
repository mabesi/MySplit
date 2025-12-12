import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import i18n from '../i18n/translations';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { useConfig } from '../context/ConfigContext';

export default function HelpScreen() {
    const router = useRouter();
    const { launched, updated } = useConfig();
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return '';
        try {
            // Create date object and adjust for timezone if necessary, 
            // but usually simple date string "YYYY-MM-DD" works well with new Date()
            // However, to ensure we don't get timezone shifts, we can treat it as UTC or just split it.
            // Let's rely on standard Date parsing for now.
            const date = new Date(dateString);
            return date.toLocaleDateString(i18n.locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    const formattedLaunched = formatDate(launched);
    const formattedUpdated = formatDate(updated);

    const sections = [
        {
            id: 'createGroup',
            icon: 'add-circle-outline',
            title: i18n.t('helpCreateGroupTitle'),
            content: i18n.t('helpCreateGroupContent')
        },
        {
            id: 'joinGroup',
            icon: 'enter-outline',
            title: i18n.t('helpJoinGroupTitle'),
            content: i18n.t('helpJoinGroupContent')
        },
        {
            id: 'addExpense',
            icon: 'receipt-outline',
            title: i18n.t('helpAddExpenseTitle'),
            content: i18n.t('helpAddExpenseContent')
        },
        {
            id: 'viewBalances',
            icon: 'analytics-outline',
            title: i18n.t('helpViewBalancesTitle'),
            content: i18n.t('helpViewBalancesContent')
        },
        {
            id: 'settleUp',
            icon: 'checkmark-circle-outline',
            title: i18n.t('helpSettleUpTitle'),
            content: i18n.t('helpSettleUpContent')
        },
        {
            id: 'shareGroup',
            icon: 'share-social-outline',
            title: i18n.t('helpShareGroupTitle'),
            content: i18n.t('helpShareGroupContent')
        },
        {
            id: 'appInfo',
            icon: 'information-circle-outline',
            title: i18n.t('helpAppInfoTitle'),
            content: i18n.t('helpAppInfoContent', { launched: formattedLaunched, updated: formattedUpdated })
        }
    ];

    return (
        <ScreenWrapper>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{i18n.t('help')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Introduction */}
                <View style={styles.introSection}>
                    <Ionicons name="help-circle-outline" size={60} color="#6366F1" />
                    <Text style={styles.introTitle}>{i18n.t('helpIntroTitle')}</Text>
                    <Text style={styles.introText}>{i18n.t('helpIntroText')}</Text>
                </View>

                {/* Collapsible Sections */}
                {sections.map((section) => (
                    <View key={section.id} style={styles.section}>
                        <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => toggleSection(section.id)}
                        >
                            <View style={styles.sectionHeaderLeft}>
                                <View style={styles.iconContainer}>
                                    <Ionicons name={section.icon as any} size={24} color="#6366F1" />
                                </View>
                                <Text style={styles.sectionTitle}>{section.title}</Text>
                            </View>
                            <Ionicons
                                name={expandedSection === section.id ? 'chevron-up' : 'chevron-down'}
                                size={20}
                                color="#94A3B8"
                            />
                        </TouchableOpacity>

                        {expandedSection === section.id && (
                            <View style={styles.sectionContent}>
                                <Text style={styles.sectionText}>{section.content}</Text>
                            </View>
                        )}
                    </View>
                ))}

                {/* Footer spacing */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F8FAFC',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    introSection: {
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#334155',
    },
    introTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#F8FAFC',
        marginTop: 10,
        marginBottom: 8,
    },
    introText: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
    },
    section: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#334155',
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#F8FAFC',
        flex: 1,
    },
    sectionContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 0,
    },
    sectionText: {
        fontSize: 14,
        color: '#CBD5E1',
        lineHeight: 22,
    },
});
