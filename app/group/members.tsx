import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Modal, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useGroup } from '../../context/GroupContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import i18n from '../../i18n/translations';
import { ScreenWrapper } from '../../components/ScreenWrapper';

export default function MembersScreen() {
    const router = useRouter();
    const { currentGroup, addMember, removeMember, approveMember, rejectMember, userId } = useGroup();
    const [showAddMember, setShowAddMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');

    if (!currentGroup) return null;

    const handleAddMember = async () => {
        if (!newMemberName) return;
        await addMember(newMemberName);
        setShowAddMember(false);
        setNewMemberName('');
    };

    const handleRemoveMember = (memberId: string, memberName: string) => {
        Alert.alert(
            i18n.t('remove'),
            i18n.t('removeMemberConfirm', { name: memberName }),
            [
                { text: i18n.t('cancel'), style: "cancel" },
                {
                    text: i18n.t('remove'),
                    style: "destructive",
                    onPress: async () => await removeMember(memberId)
                }
            ]
        );
    };

    const activeMembers = currentGroup.members.filter(m => m.status !== 'pending');
    const pendingMembers = currentGroup.members.filter(m => m.status === 'pending');
    const isOwner = currentGroup.ownerId === userId;

    return (
        <ScreenWrapper>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{i18n.t('members')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                {/* Pending Requests */}
                {isOwner && pendingMembers.length > 0 && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>{i18n.t('pendingRequests')}</Text>
                        <View style={styles.listContainer}>
                            {pendingMembers.map(m => (
                                <View key={m.id} style={styles.memberItem}>
                                    <View style={styles.memberInfo}>
                                        <View style={[styles.avatar, { backgroundColor: '#F59E0B' }]}>
                                            <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                                        </View>
                                        <Text style={styles.memberName}>{m.name}</Text>
                                    </View>
                                    <View style={styles.actions}>
                                        <TouchableOpacity onPress={() => approveMember(m.id)}>
                                            <Ionicons name="checkmark-circle" size={28} color="#35b288" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => rejectMember(m.id)}>
                                            <Ionicons name="close-circle" size={28} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Active Members */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{i18n.t('members')} ({activeMembers.length})</Text>
                    <View style={styles.listContainer}>
                        {activeMembers.map(m => (
                            <View key={m.id} style={styles.memberItem}>
                                <View style={styles.memberInfo}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.memberName}>{m.name}</Text>
                                        {m.id === currentGroup.ownerId && (
                                            <Text style={styles.roleText}>{i18n.t('owner')}</Text>
                                        )}
                                    </View>
                                </View>
                                {isOwner && m.id !== userId && (
                                    <TouchableOpacity onPress={() => handleRemoveMember(m.id, m.name)}>
                                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.fab} onPress={() => setShowAddMember(true)}>
                <Ionicons name="person-add" size={24} color="white" />
            </TouchableOpacity>

            {/* Add Member Modal */}
            <Modal visible={showAddMember} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{i18n.t('addMember')}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={i18n.t('namePlaceholder')}
                            placeholderTextColor="#64748B"
                            value={newMemberName}
                            onChangeText={setNewMemberName}
                            maxLength={16}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddMember(false)}>
                                <Text style={styles.cancelButtonText}>{i18n.t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={handleAddMember}>
                                <LinearGradient
                                    colors={['#35b288', '#22a699']}
                                    style={styles.gradientButton}
                                >
                                    <Text style={styles.saveButtonText}>{i18n.t('add')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC' },
    content: { flex: 1, padding: 16 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    listContainer: { backgroundColor: '#1E293B', borderRadius: 16, overflow: 'hidden' },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    memberName: { color: '#F8FAFC', fontSize: 16, fontWeight: '500' },
    roleText: { color: '#94A3B8', fontSize: 12 },
    actions: { flexDirection: 'row', gap: 12 },
    fab: {
        position: 'absolute',
        bottom: 60,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#35b288',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 16 },
    modalContent: { backgroundColor: '#1E293B', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#334155' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#F8FAFC' },
    input: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 15, color: '#F8FAFC' },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
    cancelButton: { padding: 14, marginRight: 10 },
    cancelButtonText: { color: '#94A3B8', fontSize: 15 },
    saveButton: { borderRadius: 12, overflow: 'hidden' },
    saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    gradientButton: { paddingVertical: 12, paddingHorizontal: 20 },
});
