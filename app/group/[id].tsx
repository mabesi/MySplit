import React, { useEffect, useRef, useState } from 'react';
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
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { SyncIndicator } from '../../components/SyncIndicator';
import { formatCurrencyAmount, formatCurrencyMinor, fromMinorUnits, normalizeCurrency, parseCurrencyAmount, toMinorUnits } from '../../utils/currency';
import { expenseDateString, formatDateString, parseDateInput, toDateInputValue } from '../../utils/date';

// Settlements are stored as expenses using the translated title, including legacy values.
const SETTLEMENT_KEYS = ['Settlement', 'Quitação', 'Quitación'];
const isSettlement = (expense: { title: string }) => SETTLEMENT_KEYS.includes(expense.title);

// Legacy regular expenses stored the calendar date as UTC midnight; legacy
// settlements stored Date.now(). Use local time only for the latter.
function expenseDisplayDate(expense: any): string {
    if (isSettlement(expense) && !expense.dateString) {
        const timestamp = expense.date || expense.createdAt;
        return timestamp ? toDateInputValue(new Date(timestamp)) : toDateInputValue();
    }
    return expenseDateString(expense);
}

export default function GroupDetails() {
    const { id, autoAddMemberName } = useLocalSearchParams<{ id: string; autoAddMemberName?: string }>();
    const router = useRouter();
    const { currentGroup, joinGroup, subscribeToGroup, addExpense, addMember, removeMember, deleteExpense, deleteGroup, updateGroupImage, approveMember, rejectMember, userId } = useGroup();
    const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
    const [showAddMember, setShowAddMember] = useState(false);
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [isFabExpanded, setIsFabExpanded] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [savingExpense, setSavingExpense] = useState(false);
    const savingExpenseRef = useRef(false);
    const [savingMember, setSavingMember] = useState(false);
    const savingMemberRef = useRef(false);

    // Sync status indicator
    const syncStatus = useSyncStatus(id || null);

    // Add Member Form State
    const [newMemberName, setNewMemberName] = useState('');

    // Add Expense Form State
    const [expenseTitle, setExpenseTitle] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(toDateInputValue()); // YYYY-MM-DD (local)
    const [paidBy, setPaidBy] = useState('');
    const [splitAmong, setSplitAmong] = useState<string[]>([]);

    // Pending members can view the group but cannot add expenses/members; the
    // Firestore rules enforce the same rule.
    const isActiveMember = currentGroup
        ? (Array.isArray(currentGroup.activeMemberIds)
            ? currentGroup.activeMemberIds.includes(userId)
            : currentGroup.members.some(m => m.id === userId && (m.status ?? 'active') === 'active'))
        : false;

    const currency = currentGroup ? normalizeCurrency(currentGroup.currency) : 'BRL';
    const hasCurrency = !!currentGroup?.currency;

    useEffect(() => {
        if (!id) return;

        // Join / load group
        joinGroup(id).then(res => {
            if (res.status === 'group_not_found') {
                Alert.alert(
                    i18n.t('error') || 'Error',
                    i18n.t('groupNotFound') || 'Group not found',
                    [{ text: 'OK', onPress: () => router.replace('/') }]
                );
            } else if (res.status === 'error') {
                Alert.alert(
                    i18n.t('error') || 'Error',
                    i18n.t('joinError') || 'Error joining group'
                );
            }
        });

        // Listen for group updates and handle server deletion
        const unsubscribe = subscribeToGroup(id, (updatedGroup) => {
            if (!updatedGroup) {
                Alert.alert(
                    i18n.t('error') || 'Error',
                    i18n.t('groupNotFound') || 'Group not found',
                    [{ text: 'OK', onPress: () => router.replace('/') }]
                );
            }
        });

        return () => {
            unsubscribe();
        };
    }, [id]);

    // Handle auto-add member from deep link or navigation
    useEffect(() => {
        if (!autoAddMemberName || !currentGroup || currentGroup.id !== id) return;

        const name = autoAddMemberName.trim();
        if (!name) {
            router.setParams({ autoAddMemberName: undefined });
            return;
        }

        // Check if member already exists to avoid duplicates/errors
        const exists = currentGroup.members.some(
            m => m.name.trim().toLowerCase() === name.toLowerCase()
        );

        if (exists) {
            router.setParams({ autoAddMemberName: undefined });
            return;
        }

        const add = async () => {
            const result = await addMember(name);
            if (!result.success) {
                Alert.alert(
                    i18n.t('error'),
                    i18n.t(result.status === 'name_reserved' ? 'nameReservedOwner' : 'nameTaken')
                );
            }
            router.setParams({ autoAddMemberName: undefined });
        };

        add();
    }, [autoAddMemberName, currentGroup]);

    // Set default splitAmong when opening modal
    useEffect(() => {
        if (showAddExpense && currentGroup) {
            setSplitAmong(
                currentGroup.members
                    .filter(m => m.status !== 'pending')
                    .map(m => m.id)
            );
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

    if (!currentGroup || (!!id && currentGroup.id !== id)) {
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
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 32 }}>
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: '#334155', paddingHorizontal: 20, paddingVertical: 12 }]}
                            onPress={() => router.replace('/')}
                        >
                            <Text style={styles.buttonText}>{i18n.t('backToHome')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 12 }]}
                            onPress={async () => {
                                if (id) {
                                    await joinGroup(id);
                                }
                            }}
                        >
                            <Text style={styles.buttonText}>{i18n.t('checkStatus') || 'Check Status'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScreenWrapper>
        );
    }

    const handleAddExpense = async () => {
        if (savingExpenseRef.current) return;

        savingExpenseRef.current = true;
        setSavingExpense(true);

        try {
            if (!currentGroup.currency) {
                alert(i18n.t('setCurrencyFirst'));
                return;
            }

            const activeMembers = currentGroup.members.filter(m => m.status !== 'pending');
            const activeMemberIds = new Set(activeMembers.map(m => m.id));
            const validSplitAmong = splitAmong.filter(id => activeMemberIds.has(id));

            if (!expenseTitle.trim() || !expenseAmount || !paidBy || validSplitAmong.length === 0) {
                alert(i18n.t('fillAllFields'));
                return;
            }

            if (!activeMemberIds.has(paidBy)) {
                alert(i18n.t('fillAllFields'));
                return;
            }

            const parsedMinor = parseCurrencyAmount(expenseAmount, currency);

            if (parsedMinor === null) {
                alert(i18n.t('invalidAmount'));
                return;
            }

            const parsedAmount = fromMinorUnits(parsedMinor, currency);
            const dateTimestamp = parseDateInput(expenseDate).getTime();
            await addExpense(expenseTitle.trim(), parsedAmount, paidBy, validSplitAmong, dateTimestamp, expenseDate);
            setShowAddExpense(false);
            setExpenseTitle('');
            setExpenseAmount('');
            setExpenseDate(toDateInputValue());
            setPaidBy('');
        } finally {
            savingExpenseRef.current = false;
            setSavingExpense(false);
        }
    };

    const handleAddMember = async () => {
        if (savingMemberRef.current) return;

        const name = newMemberName.trim();
        if (!name) return;

        savingMemberRef.current = true;
        setSavingMember(true);

        try {
            const result = await addMember(name);
            if (!result.success) {
                Alert.alert(
                    i18n.t('error'),
                    i18n.t(result.status === 'name_reserved' ? 'nameReservedOwner' : 'nameTaken')
                );
                return;
            }

            setShowAddMember(false);
            setNewMemberName('');
        } finally {
            savingMemberRef.current = false;
            setSavingMember(false);
        }
    };

    const toggleSplitMember = (memberId: string) => {
        if (splitAmong.includes(memberId)) {
            setSplitAmong(splitAmong.filter(id => id !== memberId));
        } else {
            setSplitAmong([...splitAmong, memberId]);
        }
    };

    const handleSettleUp = (fromName: string, toName: string, amount: number) => {
        if (!currentGroup.currency) {
            alert(i18n.t('setCurrencyFirst'));
            return;
        }

        const fromMember = currentGroup.members.find(m => m.name === fromName);
        const toMember = currentGroup.members.find(m => m.name === toName);

        if (!fromMember || !toMember) return;

        Alert.alert(
            i18n.t('settleUp'),
            i18n.t('confirmSettle', { amount: formatCurrencyAmount(amount, currency, i18n.locale), from: fromName, to: toName }),
            [
                { text: i18n.t('cancel'), style: "cancel" },
                {
                    text: i18n.t('save'),
                    onPress: async () => {
                        if (savingExpenseRef.current) return;

                        savingExpenseRef.current = true;
                        setSavingExpense(true);

                        try {
                            await addExpense(
                                i18n.t('settlement'),
                                amount,
                                fromMember.id,
                                [toMember.id]
                            );
                        } finally {
                            savingExpenseRef.current = false;
                            setSavingExpense(false);
                        }
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
                        onPress={async () => {
                            await Clipboard.setStringAsync(currentGroup.id);
                            Alert.alert(i18n.t('copied') || 'Copied!', i18n.t('groupIdCopied') || 'Group ID copied to clipboard');
                        }}
                        style={styles.idContainer}
                    >
                        <Text style={styles.headerId}>ID: {currentGroup.id}</Text>
                        <Ionicons name="copy-outline" size={12} color="#6366F1" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>
                <View style={styles.headerActions}>
                    <SyncIndicator status={syncStatus} variant="icon" size="medium" />
                    <TouchableOpacity onPress={() => router.push('/group/settings')} style={styles.settingsButton}>
                        <Ionicons name="settings-outline" size={24} color="#F8FAFC" />
                        {/* Show dot if there are pending requests */}
                        {currentGroup.ownerId === userId && currentGroup.members.some(m => m.status === 'pending') && (
                            <View style={styles.notificationDot} />
                        )}
                    </TouchableOpacity>
                </View>
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
                        {formatCurrencyMinor(currentGroup.expenses.filter(e => !isSettlement(e)).reduce((sum: number, e: any) => sum + toMinorUnits(e.amount, currency), 0), currency, i18n.locale)}
                    </Text>
                </View>
            </View>

            {!hasCurrency && (
                <View style={styles.currencyBanner}>
                    <Ionicons name="cash-outline" size={16} color="#F59E0B" />
                    <Text style={styles.currencyBannerText}>
                        {currentGroup.ownerId === userId
                            ? i18n.t('setCurrencyFirst')
                            : i18n.t('currencyOwnerSet')}
                    </Text>
                </View>
            )}

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
                            const settlement = isSettlement(item);
                            const displayTitle = settlement ? i18n.t('settlement') : item.title;
                            return (
                                <View style={[styles.expenseItem, settlement && styles.settlementItem]}>
                                    <View style={[styles.expenseIcon, settlement && styles.settlementIcon]}>
                                        <Ionicons
                                            name={settlement ? "checkmark" : "receipt-outline"}
                                            size={18}
                                            color={settlement ? "#35b288" : "#94A3B8"}
                                        />
                                    </View>
                                    <View style={styles.expenseDetails}>
                                        <Text style={styles.expenseTitle}>{displayTitle}</Text>
                                        <Text style={styles.expensePayer}>
                                            {i18n.t('paidBy')} <Text style={{ color: '#818CF8', fontWeight: 'bold' }}>{currentGroup.members.find((m: any) => m.id === item.paidBy)?.name || i18n.t('unknown')}</Text>
                                        </Text>
                                        <Text style={styles.expenseParticipants}>
                                            {i18n.t('for')} {item.splitAmong.map(id => currentGroup.members.find(m => m.id === id)?.name).join(', ')}
                                        </Text>
                                    </View>
                                    <View style={styles.expenseRight}>
                                        <Text style={[styles.expenseAmount, settlement && styles.settlementAmount]}>
                                            {formatCurrencyAmount(item.amount, currency, i18n.locale)}
                                        </Text>
                                        <Text style={styles.expenseDate}>
                                            {formatDateString(expenseDisplayDate(item), i18n.locale)}
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
                                        {formatCurrencyAmount(Math.abs(b.balance), currency, i18n.locale)}
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
                                        <Text style={styles.transactionAmount}>{formatCurrencyAmount(t.amount, currency, i18n.locale)}</Text>
                                    </View>
                                    {isActiveMember && hasCurrency && (
                                        <TouchableOpacity
                                            style={styles.settleButton}
                                            onPress={() => handleSettleUp(t.from, t.to, t.amount)}
                                        >
                                            <Text style={styles.settleButtonText}>{i18n.t('settleUp')}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))
                        )}
                    </ScrollView>
                )}
            </View>

            {/* ... (FABs) ... */}
            {/* Expandable FAB (active members only) */}
            {isActiveMember && (
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

                                if (!hasCurrency) {
                                    if (currentGroup.ownerId === userId) {
                                        Alert.alert(
                                            i18n.t('currency'),
                                            i18n.t('setCurrencyFirst'),
                                            [
                                                { text: i18n.t('cancel'), style: 'cancel' },
                                                {
                                                    text: i18n.t('groupSettings'),
                                                    onPress: () => router.push('/group/settings')
                                                }
                                            ]
                                        );
                                    } else {
                                        Alert.alert(i18n.t('currency'), i18n.t('currencyOwnerSet'));
                                    }
                                    return;
                                }

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
            )}

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
                            placeholder={`${i18n.t('amount')} (${currency})`}
                            placeholderTextColor="#64748B"
                            keyboardType="decimal-pad"
                            value={expenseAmount}
                            onChangeText={(text) => {
                                // Keep digits and both separators;
                                // parseCurrencyAmount validates on submit.
                                setExpenseAmount(text.replace(/[^0-9.,]/g, ''));
                            }}
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
                                value={parseDateInput(expenseDate)}
                                mode="date"
                                display="default"
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) {
                                        setExpenseDate(toDateInputValue(selectedDate));
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
                            <TouchableOpacity
                                style={[styles.saveButton, savingExpense && { opacity: 0.7 }]}
                                onPress={handleAddExpense}
                                disabled={savingExpense}
                            >
                                <LinearGradient
                                    colors={['#fba74f', '#e09646']}
                                    style={styles.gradientButton}
                                >
                                    <Text style={styles.saveButtonText}>
                                        {savingExpense ? `${i18n.t('save')}...` : i18n.t('save')}
                                    </Text>
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
                            <TouchableOpacity
                                style={[styles.saveButton, savingMember && { opacity: 0.7 }]}
                                onPress={handleAddMember}
                                disabled={savingMember}
                            >
                                <LinearGradient
                                    colors={['#35b288', '#22a699']}
                                    style={styles.gradientButton}
                                >
                                    <Text style={styles.saveButtonText}>
                                        {savingMember ? `${i18n.t('add')}...` : i18n.t('add')}
                                    </Text>
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
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
    currencyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.35)',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginHorizontal: 16,
        marginBottom: 8
    },
    currencyBannerText: { flex: 1, color: '#F59E0B', fontSize: 12 },
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
