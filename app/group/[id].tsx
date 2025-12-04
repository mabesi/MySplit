import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, Alert, Image } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useGroup } from '../../context/GroupContext';
import { calculateBalances, Balance, Transaction } from '../../utils/splitLogic';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import i18n from '../../i18n/translations';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function GroupDetails() {
    const { id, autoAddMemberName } = useLocalSearchParams<{ id: string; autoAddMemberName?: string }>();
    const router = useRouter();
    const { currentGroup, joinGroup, addExpense, addMember, removeMember, deleteExpense, deleteGroup, updateGroupImage, approveMember, rejectMember, userId } = useGroup();
    const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
    const [showAddMember, setShowAddMember] = useState(false);
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [isFabExpanded, setIsFabExpanded] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    // Add Member Form State
    const [newMemberName, setNewMemberName] = useState('');

    // Add Expense Form State
    const [expenseTitle, setExpenseTitle] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [paidBy, setPaidBy] = useState('');
    const [splitAmong, setSplitAmong] = useState<string[]>([]);

    useEffect(() => {
        if (id && (!currentGroup || currentGroup.id !== id)) {
            joinGroup(id);
        }
    }, [id]);

    // Handle auto-add member from deep link or navigation
    useEffect(() => {
        if (autoAddMemberName && currentGroup && currentGroup.id === id) {
            // Check if member already exists to avoid duplicates/errors
            const exists = currentGroup.members.some(m => m.name.toLowerCase() === autoAddMemberName.toLowerCase());
            if (!exists) {
                addMember(autoAddMemberName);
                // Clear param? We can't easily clear search params in expo-router without replace
                router.setParams({ autoAddMemberName: undefined });
            }
        }
    }, [autoAddMemberName, currentGroup]);

    // Set default splitAmong when opening modal
    useEffect(() => {
        if (showAddExpense && currentGroup) {
            setSplitAmong(currentGroup.members.map(m => m.id));
        }
    }, [showAddExpense, currentGroup]);

    // Force balance recalculation with state
    const [balances, setBalances] = React.useState<Balance[]>([]);
    const [transactions, setTransactions] = React.useState<Transaction[]>([]);

    React.useEffect(() => {
        if (currentGroup) {
            const result = calculateBalances(currentGroup);
            setBalances(result.balances);
            setTransactions(result.transactions);
        }
    }, [currentGroup, currentGroup?.expenses.length, currentGroup?.members.length]);

    if (!currentGroup) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <Text style={styles.loadingText}>{i18n.t('loading')}</Text>
                </View>
            </ScreenWrapper>
        );
    }

    // Check if current user is pending
    const currentUserMember = currentGroup.members.find(m => m.id === userId);
    const isPending = currentUserMember?.status === 'pending';

    if (isPending) {
        return (
            <ScreenWrapper>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={styles.center}>
                    <Ionicons name="time-outline" size={64} color="#F59E0B" style={{ marginBottom: 16 }} />
                    <Text style={[styles.headerTitle, { marginBottom: 8 }]}>{i18n.t('approvalPending')}</Text>
                    <Text style={[styles.subtitle, { paddingHorizontal: 32 }]}>
                        {i18n.t('waitApprovalMessage', { groupName: currentGroup.name })}
                    </Text>
                    <TouchableOpacity
                        style={[styles.button, { marginTop: 32, backgroundColor: '#334155', paddingHorizontal: 24, paddingVertical: 12 }]}
                        onPress={() => router.replace('/')}
                    >
                        <Text style={styles.buttonText}>{i18n.t('backToHome')}</Text>
                    </TouchableOpacity>
                </View>
            </ScreenWrapper>
        );
    }

    const handleAddExpense = async () => {
        if (!expenseTitle || !expenseAmount || !paidBy || splitAmong.length === 0) {
            alert(i18n.t('fillAllFields'));
            return;
        }
        const dateTimestamp = new Date(expenseDate).getTime();
        await addExpense(expenseTitle, parseFloat(expenseAmount), paidBy, splitAmong, dateTimestamp);
        setShowAddExpense(false);
        setExpenseTitle('');
        setExpenseAmount('');
        setExpenseDate(new Date().toISOString().split('T')[0]);
        setPaidBy('');
    };

    const handleAddMember = async () => {
        if (!newMemberName) return;
        await addMember(newMemberName);
        setShowAddMember(false);
        setNewMemberName('');
    };

    const toggleSplitMember = (memberId: string) => {
        if (splitAmong.includes(memberId)) {
            setSplitAmong(splitAmong.filter(id => id !== memberId));
        } else {
            setSplitAmong([...splitAmong, memberId]);
        }
    };

    const handleSettleUp = (fromName: string, toName: string, amount: number) => {
        const fromMember = currentGroup.members.find(m => m.name === fromName);
        const toMember = currentGroup.members.find(m => m.name === toName);

        if (!fromMember || !toMember) return;

        Alert.alert(
            i18n.t('settleUp'),
            i18n.t('confirmSettle', { amount: amount.toFixed(2), from: fromName, to: toName }),
            [
                { text: i18n.t('cancel'), style: "cancel" },
                {
                    text: i18n.t('save'),
                    onPress: async () => {
                        await addExpense(
                            "Settlement",
                            amount,
                            fromMember.id,
                            [toMember.id]
                        );
                    }
                }
            ]
        );
    };

    return (
        <ScreenWrapper>
            {/* ... (Header) ... */}
            <Stack.Screen options={{ headerShown: false }} />

            {/* Custom Header - Compact */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>{currentGroup.name}</Text>
                    <TouchableOpacity
                        onPress={() => {
                            Clipboard.setString(currentGroup.id);
                            Alert.alert(i18n.t('copied') || 'Copied!', i18n.t('groupIdCopied') || 'Group ID copied to clipboard');
                        }}
                        style={styles.idContainer}
                    >
                        <Text style={styles.headerId}>ID: {currentGroup.id}</Text>
                        <Ionicons name="copy-outline" size={12} color="#6366F1" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => router.push('/group/settings')} style={styles.settingsButton}>
                    <Ionicons name="settings-outline" size={24} color="#F8FAFC" />
                    {/* Show dot if there are pending requests */}
                    {currentGroup.ownerId === userId && currentGroup.members.some(m => m.status === 'pending') && (
                        <View style={styles.notificationDot} />
                    )}
                </TouchableOpacity>
            </View>

            {/* ... (Group Info) ... */}
            <View style={styles.groupInfoContainer}>
                <View style={styles.groupImageContainer}>
                    {currentGroup.imageUrl ? (
                        <Image source={{ uri: currentGroup.imageUrl }} style={styles.groupImageSquare} />
                    ) : (
                        <View style={styles.groupImagePlaceholder}>
                            <Ionicons name="people" size={32} color="#94A3B8" />
                        </View>
                    )}
                </View>
                <View style={styles.totalContainer}>
                    <Text style={styles.statLabel}>{i18n.t('totalExpenses')}</Text>
                    <Text style={styles.statValue}>
                        ${currentGroup.expenses.reduce((sum: number, e: any) => sum + e.amount, 0).toFixed(2)}
                    </Text>
                </View>
            </View>

            {/* ... (Tabs) ... */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'expenses' && styles.activeTab]}
                    onPress={() => setActiveTab('expenses')}
                >
                    <Text style={[styles.tabText, activeTab === 'expenses' && styles.activeTabText]}>{i18n.t('expenses')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'balances' && styles.activeTab]}
                    onPress={() => setActiveTab('balances')}
                >
                    <Text style={[styles.tabText, activeTab === 'balances' && styles.activeTabText]}>{i18n.t('balances')}</Text>
                </TouchableOpacity>
            </View>

            {/* ... (Content) ... */}
            <View style={styles.contentContainer}>
                {activeTab === 'expenses' ? (
                    <FlatList
                        data={currentGroup.expenses.slice().reverse()} // Newest first
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => {
                            const isSettlement = item.title === "Settlement";
                            return (
                                <View style={[styles.expenseItem, isSettlement && styles.settlementItem]}>
                                    <View style={[styles.expenseIcon, isSettlement && styles.settlementIcon]}>
                                        <Ionicons
                                            name={isSettlement ? "checkmark" : "receipt-outline"}
                                            size={18}
                                            color={isSettlement ? "#35b288" : "#94A3B8"}
                                        />
                                    </View>
                                    <View style={styles.expenseDetails}>
                                        <Text style={styles.expenseTitle}>{item.title}</Text>
                                        <Text style={styles.expensePayer}>
                                            {i18n.t('paidBy')} <Text style={{ color: '#818CF8', fontWeight: 'bold' }}>{currentGroup.members.find((m: any) => m.id === item.paidBy)?.name || i18n.t('unknown')}</Text>
                                        </Text>
                                        <Text style={styles.expenseParticipants}>
                                            {i18n.t('for')} {item.splitAmong.map(id => currentGroup.members.find(m => m.id === id)?.name).join(', ')}
                                        </Text>
                                    </View>
                                    <View style={styles.expenseRight}>
                                        <Text style={[styles.expenseAmount, isSettlement && styles.settlementAmount]}>
                                            ${item.amount.toFixed(2)}
                                        </Text>
                                        <Text style={styles.expenseDate}>
                                            {new Date(item.date || item.createdAt).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    {/* Delete button - only for creator or group owner */}
                                    {(item.createdBy === userId || currentGroup.ownerId === userId) && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                Alert.alert(
                                                    i18n.t('remove'),
                                                    i18n.t('confirmDelete') || 'Delete this expense?',
                                                    [
                                                        { text: i18n.t('cancel'), style: 'cancel' },
                                                        { text: i18n.t('remove'), style: 'destructive', onPress: () => deleteExpense(item.id) }
                                                    ]
                                                );
                                            }}
                                            style={styles.deleteButton}
                                        >
                                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        }}
                        ListEmptyComponent={<Text style={styles.emptyText}>{i18n.t('noExpenses')}</Text>}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                        <Text style={styles.sectionTitle}>{i18n.t('netBalances')}</Text>
                        {balances.length === 0 ? (
                            <Text style={styles.emptyText}>No members yet</Text>
                        ) : (
                            balances.map(b => (
                                <View key={b.memberId} style={styles.balanceItem}>
                                    <Text style={styles.memberName}>{b.memberName}</Text>
                                    <Text style={[styles.balanceAmount, b.balance >= 0 ? styles.positive : styles.negative]}>
                                        ${Math.abs(b.balance).toFixed(2)}
                                    </Text>
                                </View>
                            ))
                        )}

                        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>{i18n.t('howToSettle')}</Text>
                        {transactions.length === 0 ? (
                            <View style={styles.settledContainer}>
                                <Ionicons name="checkmark-done-circle" size={40} color="#35b288" />
                                <Text style={styles.settledText}>{i18n.t('allSettled')}</Text>
                            </View>
                        ) : (
                            transactions.map((t, index) => (
                                <View key={index} style={styles.transactionItem}>
                                    <View style={styles.transactionInfo}>
                                        <Text style={styles.transactionText}>
                                            <Text style={{ fontWeight: 'bold', color: '#F8FAFC' }}>{t.from}</Text> {i18n.t('pays')} <Text style={{ fontWeight: 'bold', color: '#F8FAFC' }}>{t.to}</Text>
                                        </Text>
                                        <Text style={styles.transactionAmount}>${t.amount.toFixed(2)}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.settleButton}
                                        onPress={() => handleSettleUp(t.from, t.to, t.amount)}
                                    >
                                        <Text style={styles.settleButtonText}>{i18n.t('settleUp')}</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </ScrollView>
                )}
            </View>

            {/* ... (FABs) ... */}
            {/* Expandable FAB */}
            <View style={styles.fabContainer}>
                {isFabExpanded && (
                    <>
                        <TouchableOpacity
                            style={[styles.fab, { backgroundColor: '#35b288', marginBottom: 16 }]}
                            onPress={() => {
                                setIsFabExpanded(false);
                                setShowAddMember(true);
                            }}
                        >
                            <Ionicons name="person-add-outline" size={24} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.fab, { backgroundColor: '#fba74f', marginBottom: 16 }]}
                            onPress={() => {
                                setIsFabExpanded(false);
                                setShowAddExpense(true);
                            }}
                        >
                            <Ionicons name="receipt-outline" size={24} color="white" />
                        </TouchableOpacity>
                    </>
                )}
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: isFabExpanded ? '#475569' : '#fba74f' }]}
                    onPress={() => setIsFabExpanded(!isFabExpanded)}
                >
                    {!isFabExpanded && (
                        <LinearGradient
                            colors={['#fba74f', '#e09646']}
                            style={StyleSheet.absoluteFill}
                        />
                    )}
                    <Ionicons name={isFabExpanded ? "close" : "add"} size={30} color="white" />
                </TouchableOpacity>
            </View>

            {/* ... (Add Expense Modal) ... */}
            <Modal visible={showAddExpense} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{i18n.t('addExpense')}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={i18n.t('whatFor')}
                            placeholderTextColor="#64748B"
                            value={expenseTitle}
                            onChangeText={setExpenseTitle}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder={i18n.t('amount')}
                            placeholderTextColor="#64748B"
                            keyboardType="numeric"
                            value={expenseAmount}
                            onChangeText={setExpenseAmount}
                        />

                        <Text style={styles.label}>{i18n.t('date') || 'Date'}</Text>
                        <TouchableOpacity
                            style={styles.input}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text style={{ color: '#F8FAFC', paddingVertical: 4 }}>{expenseDate}</Text>
                        </TouchableOpacity>
                        {showDatePicker && (
                            <DateTimePicker
                                value={new Date(expenseDate)}
                                mode="date"
                                display="default"
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) {
                                        setExpenseDate(selectedDate.toISOString().split('T')[0]);
                                    }
                                }}
                            />
                        )}

                        <Text style={styles.label}>{i18n.t('paidBy')}</Text>
                        <View style={styles.chips}>
                            {currentGroup.members.filter(m => m.status !== 'pending').map(m => (
                                <TouchableOpacity
                                    key={m.id}
                                    style={[styles.chip, paidBy === m.id && styles.activeChip]}
                                    onPress={() => setPaidBy(m.id)}
                                >
                                    <Text style={[styles.chipText, paidBy === m.id && styles.activeChipText]}>{m.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>{i18n.t('splitAmong')}</Text>
                        <View style={styles.chips}>
                            {currentGroup.members.filter(m => m.status !== 'pending').map(m => (
                                <TouchableOpacity
                                    key={m.id}
                                    style={[styles.chip, splitAmong.includes(m.id) && styles.activeChip]}
                                    onPress={() => toggleSplitMember(m.id)}
                                >
                                    <Text style={[styles.chipText, splitAmong.includes(m.id) && styles.activeChipText]}>{m.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddExpense(false)}>
                                <Text style={styles.cancelButtonText}>{i18n.t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={handleAddExpense}>
                                <LinearGradient
                                    colors={['#fba74f', '#e09646']}
                                    style={styles.gradientButton}
                                >
                                    <Text style={styles.saveButtonText}>{i18n.t('save')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ... (Add Member Modal) ... */}
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

            {/* Settings Modal Removed */}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#94A3B8', marginTop: 10 },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    backButton: { padding: 4 },
    headerContent: { alignItems: 'center' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#F8FAFC' },
    idContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    headerId: { fontSize: 11, color: '#94A3B8' },
    settingsButton: { padding: 4 },
    groupInfoContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 16,
        alignItems: 'center',
        gap: 12,
    },
    groupImageContainer: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    groupImageSquare: { width: 80, height: 80, borderRadius: 16, resizeMode: 'cover' },
    groupImagePlaceholder: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    totalContainer: { flex: 1, alignItems: 'flex-end' },
    statLabel: { color: '#94A3B8', fontSize: 13 },
    statValue: { fontSize: 32, fontWeight: 'bold', color: '#F8FAFC' },
    tabs: {
        flexDirection: 'row',
        marginHorizontal: 16,
        backgroundColor: '#1E293B',
        borderRadius: 12,
        padding: 3,
        marginBottom: 12,
    },
    tab: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 10 },
    activeTab: { backgroundColor: '#334155' },
    tabText: { color: '#64748B', fontWeight: '600', fontSize: 13 },
    activeTabText: { color: '#F8FAFC' },
    contentContainer: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 100 },
    scrollContent: { paddingHorizontal: 16 },
    expenseItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
    settlementItem: { backgroundColor: 'rgba(53, 178, 136, 0.1)', borderColor: 'rgba(53, 178, 136, 0.2)' },
    expenseIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    settlementIcon: { backgroundColor: 'rgba(53, 178, 136, 0.2)' },
    expenseDetails: { flex: 1 },
    expenseTitle: { fontSize: 15, fontWeight: '600', color: '#F8FAFC' },
    expensePayer: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
    expenseParticipants: { fontSize: 11, color: '#64748B', marginTop: 2 },
    expenseRight: { alignItems: 'flex-end' },
    expenseAmount: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC' },
    expenseDate: { fontSize: 10, color: '#64748B', marginTop: 4 },
    deleteButton: { marginLeft: 10, padding: 6 },
    settlementAmount: { color: '#35b288' },
    emptyText: { textAlign: 'center', color: '#64748B', marginTop: 20 },
    balanceItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#334155' },
    memberName: { fontSize: 15, color: '#E2E8F0', fontWeight: '500' },
    balanceAmount: { fontSize: 15, fontWeight: 'bold' },
    positive: { color: '#35b288' },
    negative: { color: '#EF4444' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 12 },
    transactionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E293B', padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
    transactionInfo: { flex: 1 },
    transactionText: { color: '#94A3B8', fontSize: 13 },
    transactionAmount: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC', marginTop: 4 },
    settleButton: { backgroundColor: '#35b288', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    settleButtonText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    settledContainer: { alignItems: 'center', marginTop: 30 },
    settledText: { color: '#35b288', fontSize: 16, fontWeight: 'bold', marginTop: 10 },
    fabContainer: { position: 'absolute', bottom: 60, right: 16, alignItems: 'center' },
    fab: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, overflow: 'hidden' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 16 },
    modalContent: { backgroundColor: '#1E293B', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#334155' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#F8FAFC' },
    input: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 15, color: '#F8FAFC' },
    label: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginBottom: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
    chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, backgroundColor: '#334155', marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#475569' },
    activeChip: { backgroundColor: '#4F46E5', borderColor: '#6366F1' },
    chipText: { color: '#94A3B8', fontSize: 13 },
    activeChipText: { color: 'white', fontWeight: '600' },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
    cancelButton: { padding: 14, marginRight: 10 },
    cancelButtonText: { color: '#94A3B8', fontSize: 15 },
    saveButton: { borderRadius: 12, overflow: 'hidden' },
    saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    gradientButton: { paddingVertical: 12, paddingHorizontal: 20 },
    settingsSection: { marginBottom: 24 },
    membersContainer: { backgroundColor: '#0F172A', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#334155' },
    memberItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#334155' },
    memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    memberAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    memberAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
    imagePickerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    pickImageButton: { backgroundColor: '#334155', padding: 10, borderRadius: 8, marginRight: 12, flexDirection: 'row', alignItems: 'center' },
    pickImageText: { color: '#F8FAFC', fontSize: 13 },
    previewImage: { width: 50, height: 50, borderRadius: 8 },
    dangerZone: { borderTopWidth: 1, borderTopColor: '#334155', marginTop: 20, paddingTop: 16, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 12, padding: 12, marginHorizontal: -4 },
    dangerZoneDescription: { fontSize: 12, color: '#94A3B8', marginBottom: 12, lineHeight: 16 },
    deleteGroupButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', padding: 12, borderRadius: 10, gap: 8 },
    deleteGroupButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
    notificationDot: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#F59E0B',
        borderWidth: 1,
        borderColor: '#1E293B'
    },
    subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
    button: { borderRadius: 12, overflow: 'hidden' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 15 }
});
