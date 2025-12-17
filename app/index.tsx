import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Modal, TextInput, Linking, Alert, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGroup } from '../context/GroupContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import i18n from '../i18n/translations';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { SyncIndicator } from '../components/SyncIndicator';

// Helper component for each group in the grid
const GroupListItem = React.memo(({ groupId }: { groupId: string }) => {
    const { getGroup, joinGroup, subscribeToGroup } = useGroup();
    const router = useRouter();
    const [group, setGroup] = useState<any>(null);
    const syncStatus = useSyncStatus(groupId);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const load = async () => {
            try {
                // Try to load initial data (works from cache if offline)
                const g = await getGroup(groupId);
                if (g) {
                    setGroup(g);
                }
            } catch (error) {
                console.log(`Could not load group ${groupId} initially (might be offline):`, error);
                // Don't fail - subscription will provide data
            }

            // Subscribe for updates (works with cache)
            try {
                unsubscribe = subscribeToGroup(groupId, (updatedGroup) => {
                    setGroup(updatedGroup);
                });
            } catch (error) {
                console.error(`Failed to subscribe to group ${groupId}:`, error);
            }
        };
        load();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [groupId]);

    if (!group) return null;

    return (
        <TouchableOpacity
            style={styles.groupItem}
            onPress={() => {
                joinGroup(groupId);
                router.push(`/group/${groupId}`);
            }}
        >
            <LinearGradient colors={['#334155', '#1E293B']} style={styles.groupGradient}>
                {/* Sync Status Badge */}
                <View style={styles.syncBadgeContainer}>
                    <SyncIndicator status={syncStatus} variant="badge" />
                </View>

                {group.imageUrl ? (
                    <Image source={{ uri: group.imageUrl, cache: 'reload' }} style={styles.groupImage} key={group.imageUrl} />
                ) : (
                    <View style={styles.groupIcon}>
                        <Ionicons name="people" size={20} color="#E2E8F0" />
                    </View>
                )}
                <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
            </LinearGradient>
        </TouchableOpacity>
    );
});



// ... imports ...

export default function HomeScreen() {
    const router = useRouter();
    const { createGroup, joinGroup, myGroups, getGroup, addMember, isLoading } = useGroup();
    const [name, setName] = useState('');
    const [userName, setUserName] = useState('');
    const [joinId, setJoinId] = useState('');
    const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
    const [locale, setLocale] = useState(i18n.locale);
    const insets = useSafeAreaInsets();
    const { joinGroupId } = useLocalSearchParams<{ joinGroupId?: string }>();
    const [showJoinModal, setShowJoinModal] = useState(false); // Added this state

    // Handle deep link parameter
    useEffect(() => {
        if (joinGroupId) {
            setActiveTab('join');
            setJoinId(joinGroupId);
        }
    }, [joinGroupId]);

    const changeLanguage = (lang: string) => {
        i18n.locale = lang;
        setLocale(lang);
    };

    const handleCreate = async () => {
        if (!name || !userName) return alert(i18n.t('fillAllFields'));
        try {
            const id = await createGroup(name.toUpperCase(), userName);
            if (id) {
                setName(''); // Clear group name only
                router.push(`/group/${id}`);
            }
        } catch (e) {
            // Error already handled in context
        }
    };

    const handleJoinGroup = async () => {
        if (!joinId || !userName) return; // Changed joinGroupId to joinId and joinUserName to userName

        const result = await joinGroup(joinId, userName); // Changed joinGroupId to joinId and joinUserName to userName

        if (result.success) {
            setShowJoinModal(false);
            setJoinId(''); // Changed setJoinGroupId to setJoinId
            setUserName(''); // Changed setJoinUserName to setUserName
            router.push(`/group/${joinId}`); // Changed joinGroupId to joinId
        } else {
            if (result.status === 'already_member') {
                Alert.alert(
                    i18n.t('alreadyMember') || 'Already a member',
                    (i18n.t('alreadyMemberMessage') || 'You are already in this group as {name}. Do you want to add a new local member named {newName}?')
                        .replace('{name}', result.memberName || '')
                        .replace('{newName}', userName), // Changed joinUserName to userName
                    [
                        { text: i18n.t('cancel'), style: 'cancel' },
                        {
                            text: i18n.t('yes'),
                            onPress: async () => {
                                // Add local member logic
                                // We need to be in the group context to add a member to it?
                                // Actually addMember in context uses currentGroup.
                                // But we are not in the group view yet.
                                // So we need to set the current group first?
                                // Or we can expose a method to add member to a specific group ID?
                                // The current addMember implementation in context uses currentGroup.
                                // Let's check context... it uses currentGroup.
                                // So we might need to "enter" the group first or modify addMember.
                                // For now, let's assume we can navigate to the group and then add?
                                // Or better: The user is "already in the group", so we can just navigate them there
                                // and THEN trigger the add member?
                                // OR: We can temporarily set the group as current and add.

                                // Wait, if I am already a member, I can just open the group.
                                // But the user wants to add a NEW member (local).
                                // If I navigate to group, I am viewing it as myself.
                                // Then I can add a member.

                                // Let's try: Navigate to group, then call addMember?
                                // But addMember needs the group loaded.

                                // Alternative: Update context to allow adding member by ID?
                                // StorageService has addMember(groupId, ...).
                                // Context's addMember uses currentGroup.

                                // Let's just navigate to the group and show a success message?
                                // But the requirement is "add a new member local with the name informed".
                                // So we should do it.

                                // Since we are in the "Home" screen, currentGroup is likely null.
                                // We can use getGroup to fetch it, set it, and then add?
                                // But joinGroup already does some of that if successful.

                                // Let's modify the plan slightly:
                                // 1. Navigate to group (since user is member).
                                // 2. Pass a param to auto-trigger add member?
                                // OR: Just call storage service directly? No, context is better.

                                // Let's use the fact that we can just join the group (locally) since we are a member.
                                // We can call joinGroup again? No, it returns already_member.

                                // Let's just navigate to the group.
                                // And we need to add the member.
                                // Maybe we can use a special param in route?
                                router.push({
                                    pathname: `/group/${joinId}`, // Changed joinGroupId to joinId
                                    params: { autoAddMemberName: userName } // Changed joinUserName to userName
                                });
                                setShowJoinModal(false);
                                setJoinId(''); // Changed setJoinGroupId to setJoinId
                                setUserName(''); // Changed setJoinUserName to setUserName
                            }
                        }
                    ]
                );
            } else if (result.status === 'name_taken') {
                Alert.alert(i18n.t('error'), i18n.t('nameTaken') || 'Name already taken');
            } else if (result.status === 'group_not_found') {
                Alert.alert(i18n.t('error'), i18n.t('groupNotFound') || 'Group not found');
            } else {
                Alert.alert(i18n.t('error'), i18n.t('joinError') || 'Error joining group');
            }
        }
    };

    return (
        <ScreenWrapper useBottomInset={false}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior="padding"
            >
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header Section */}
                    <View style={styles.headerSection}>
                        <View style={styles.headerRow}>
                            {/* Column 1: Logo (60%) */}
                            <View style={styles.logoColumn}>
                                <Image
                                    source={require('../assets/logo.png')}
                                    style={styles.logoImage}
                                    resizeMode="contain"
                                />
                            </View>

                            {/* Column 2: Flags (40%) */}
                            <View style={styles.flagsColumn}>
                                <View style={styles.languageSwitcher}>
                                    <TouchableOpacity style={[styles.langButton, locale === 'en' && styles.activeLang]} onPress={() => changeLanguage('en')}>
                                        <Text style={styles.flagEmoji}>🇺🇸</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.langButton, locale === 'es' && styles.activeLang]} onPress={() => changeLanguage('es')}>
                                        <Text style={styles.flagEmoji}>🇪🇸</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.langButton, locale === 'pt' && styles.activeLang]} onPress={() => changeLanguage('pt')}>
                                        <Text style={styles.flagEmoji}>🇧🇷</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* Subtitle below header */}
                        <Text style={styles.subtitle}>{i18n.t('appSubtitle')}</Text>
                    </View>

                    {/* My Groups Section */}
                    {myGroups.length > 0 ? (
                        <View style={styles.section}>
                            <View style={styles.sectionHeaderBox}>
                                <Text style={styles.sectionTitle}>{i18n.t('myGroups') || 'My Groups'}</Text>
                            </View>
                            <View style={styles.groupsGrid}>
                                {myGroups.map((groupId) => (
                                    <View key={groupId} style={styles.groupGridItem}>
                                        <GroupListItem groupId={groupId} />
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{i18n.t('createNewGroup') || 'Create a New Group to Split!'}</Text>
                        </View>
                    )}

                    {/* Create / Join Section */}
                    <View style={styles.section}>
                        <View style={styles.card}>
                            <View style={styles.tabs}>
                                <TouchableOpacity style={[styles.tab, activeTab === 'create' && styles.activeTab]} onPress={() => setActiveTab('create')}>
                                    <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>{i18n.t('create')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.tab, activeTab === 'join' && styles.activeTab]} onPress={() => setActiveTab('join')}>
                                    <Text style={[styles.tabText, activeTab === 'join' && styles.activeTabText]}>{i18n.t('join')}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formContent}>
                                {activeTab === 'create' ? (
                                    <>
                                        <View style={styles.inputContainer}>
                                            <Ionicons name="people-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder={i18n.t('groupNamePlaceholder')}
                                                placeholderTextColor="#64748B"
                                                value={name}
                                                onChangeText={setName}
                                                maxLength={16}
                                            />
                                        </View>
                                        <View style={styles.inputContainer}>
                                            <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder={i18n.t('yourNamePlaceholder')}
                                                placeholderTextColor="#64748B"
                                                value={userName}
                                                onChangeText={setUserName}
                                                maxLength={16}
                                            />
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.button, isLoading && { opacity: 0.7 }]}
                                            onPress={handleCreate}
                                            disabled={isLoading}
                                        >
                                            <LinearGradient colors={['#35b288', '#22a699']} style={styles.gradientButton}>
                                                <Text style={styles.buttonText}>
                                                    {isLoading ? 'Creating...' : i18n.t('createGroup')}
                                                </Text>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <View style={styles.inputContainer}>
                                            <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder={i18n.t('yourNamePlaceholder')}
                                                placeholderTextColor="#64748B"
                                                value={userName}
                                                onChangeText={setUserName}
                                            />
                                        </View>
                                        <View style={styles.inputContainer}>
                                            <Ionicons name="key-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder={i18n.t('groupIdPlaceholder')}
                                                placeholderTextColor="#64748B"
                                                value={joinId}
                                                onChangeText={setJoinId}
                                                autoCapitalize="none"
                                            />
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.button, isLoading && { opacity: 0.7 }]}
                                            onPress={handleJoinGroup}
                                            disabled={isLoading}
                                        >
                                            <LinearGradient colors={['#fba74f', '#e09646']} style={styles.gradientButton}>
                                                <Text style={styles.buttonText}>
                                                    {isLoading ? 'Joining...' : i18n.t('joinGroup')}
                                                </Text>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Donation Section */}
                    <View style={styles.donationSection}>
                        <TouchableOpacity style={styles.donateButton} onPress={() => router.push('/donate')}>
                            <LinearGradient colors={['#F43F5E', '#f35477ff']} style={[styles.gradientButton, styles.donationGradient]}>
                                <Ionicons name="heart" size={24} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.buttonText}>{i18n.t('donate')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_BASE_URL!)} style={styles.footerContent}>
                            <Image
                                source={require('../assets/mabesi_logo.png')}
                                style={styles.footerLogo}
                                resizeMode="contain"
                            />
                            <View style={styles.footerTextContainer}>
                                <Text style={styles.footerTitle}>Mabesi Apps</Text>
                                <Text style={styles.footerUrl}>{process.env.EXPO_PUBLIC_BASE_URL?.replace('https://', '')}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* FAB - Help Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/help')}
                activeOpacity={0.8}
            >
                <LinearGradient colors={['#35b288', '#22a699']} style={styles.fabGradient}>
                    <Ionicons name="help-circle" size={40} color="white" />
                </LinearGradient>
            </TouchableOpacity>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    headerSection: {
        marginTop: 20,
        marginBottom: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    logoColumn: {
        flex: 0.65, // 65%
        alignItems: 'flex-start', // Align left as per standard, or center? User said "occupy almost all space of its column". 
        // Let's assume the logo itself should be big.
        justifyContent: 'center',
    },
    logoImage: {
        width: '90%', // 90% of the column
        height: 70,
    },
    flagsColumn: {
        flex: 0.35, // 35%
        alignItems: 'center', // Centralized
        justifyContent: 'center',
    },
    languageSwitcher: {
        flexDirection: 'row',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 20,
        padding: 4,
        width: '100%', // Occupy space
        maxWidth: 140, // Limit width so it doesn't stretch too much if column is huge
        justifyContent: 'space-around',
    },
    langButton: {
        padding: 4,
        borderRadius: 16,
    },
    activeLang: {
        backgroundColor: 'rgba(71, 243, 200, 0.84)',
    },
    flagEmoji: {
        fontSize: 18,
    },
    subtitle: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        color: 'rgba(71, 243, 200, 0.84)',
        fontSize: 16,
        fontWeight: '600',
    },
    sectionHeaderBox: {
        borderWidth: 1,
        borderColor: 'rgba(71, 243, 200, 0.3)',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignSelf: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(71, 243, 200, 0.05)',
    },
    groupsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    groupGridItem: {
        width: '40%',
        flexGrow: 1,
        margin: 5,
    },
    groupItem: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    groupGradient: {
        padding: 12,
        alignItems: 'center',
        height: 120,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    groupIcon: {
        width: 100,
        height: 80,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    groupImage: {
        width: 100,
        height: 80,
        borderRadius: 20,
        marginBottom: 8,
    },
    groupName: {
        color: '#E2E8F0',
        fontWeight: '600',
        fontSize: 13,
        textAlign: 'center',
    },
    syncBadgeContainer: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
    },
    card: {
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 6,
        borderWidth: 1,
        borderColor: '#334155',
    },
    tabs: {
        flexDirection: 'row',
        marginBottom: 12,
        backgroundColor: '#0F172A',
        borderRadius: 14,
        padding: 3,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 12,
    },
    activeTab: {
        backgroundColor: '#334155',
    },
    tabText: {
        color: '#64748B',
        fontWeight: '600',
        fontSize: 13,
    },
    activeTabText: {
        color: '#F8FAFC',
    },
    formContent: {
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#334155',
    },
    inputIcon: {
        paddingLeft: 12,
    },
    input: {
        flex: 1,
        color: '#F8FAFC',
        padding: 12,
        fontSize: 15,
    },
    button: {
        marginTop: 4,
        borderRadius: 12,
        overflow: 'hidden',
    },
    gradientButton: {
        padding: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
    donationSection: {
        marginTop: 14,
        marginBottom: 10,
        alignItems: 'center',
    },
    donateButton: {
        borderRadius: 12,
        overflow: 'hidden',
        width: '50%',
    },
    donationGradient: {
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    footer: {
        alignItems: 'center',
        paddingBottom: 32,
        marginTop: 10,
    },
    footerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerLogo: {
        width: 40,
        height: 40,
        marginRight: 12,
    },
    footerTextContainer: {
        justifyContent: 'center',
    },
    footerTitle: {
        color: '#F8FAFC',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    footerUrl: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
    },
    fab: {
        position: 'absolute',
        bottom: 60,
        right: 24,
        borderRadius: 28,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    fabGradient: {
        width: 50,
        height: 50,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
