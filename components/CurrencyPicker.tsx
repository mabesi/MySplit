import React, { useEffect, useMemo, useState } from 'react';
import { Modal, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../i18n/translations';
import { CurrencySection, getCurrencySections } from '../utils/currency';

interface CurrencyPickerProps {
    visible: boolean;
    selected: string;
    onSelect: (currency: string) => void;
    onClose: () => void;
}

export function CurrencyPicker({ visible, selected, onSelect, onClose }: CurrencyPickerProps) {
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!visible) setSearch('');
    }, [visible]);

    const sections = useMemo(() => getCurrencySections(i18n.locale), [i18n.locale]);

    const filteredSections = useMemo<CurrencySection[]>(() => {
        const query = search.trim().toLowerCase();
        if (!query) return sections;

        return sections
            .map(section => ({
                ...section,
                data: section.data.filter(option =>
                    option.code.toLowerCase().includes(query) ||
                    option.label.toLowerCase().includes(query)
                )
            }))
            .filter(section => section.data.length > 0);
    }, [sections, search]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{i18n.t('selectCurrency')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={22} color="#F8FAFC" />
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={styles.search}
                        placeholder={i18n.t('search')}
                        placeholderTextColor="#64748B"
                        value={search}
                        onChangeText={setSearch}
                        autoCapitalize="characters"
                        autoCorrect={false}
                    />

                    <SectionList
                        sections={filteredSections}
                        keyExtractor={item => item.code}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        stickySectionHeadersEnabled={false}
                        style={styles.list}
                        renderSectionHeader={({ section }) => (
                            <Text style={styles.sectionHeader}>{i18n.t(section.titleKey)}</Text>
                        )}
                        renderItem={({ item }) => {
                            const sample = item.label.split('—')[1]?.trim() || '';
                            const isSelected = item.code === selected;
                            return (
                                <TouchableOpacity
                                    style={[styles.item, isSelected && styles.selectedItem]}
                                    onPress={() => {
                                        onSelect(item.code);
                                        onClose();
                                    }}
                                >
                                    <Text style={[styles.code, isSelected && styles.selectedText]}>{item.code}</Text>
                                    <Text style={styles.sample} numberOfLines={1}>{sample}</Text>
                                    {isSelected && <Ionicons name="checkmark" size={18} color="#35b288" />}
                                </TouchableOpacity>
                            );
                        }}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.75)',
        justifyContent: 'center',
        padding: 20
    },
    container: {
        height: '80%',
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.2)'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
    },
    title: {
        color: '#F8FAFC',
        fontSize: 17,
        fontWeight: 'bold'
    },
    closeButton: {
        padding: 4
    },
    search: {
        backgroundColor: '#0F172A',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#F8FAFC',
        marginBottom: 12
    },
    list: {
        flex: 1
    },
    sectionHeader: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 14,
        marginBottom: 4,
        paddingHorizontal: 8
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
        gap: 10
    },
    selectedItem: {
        backgroundColor: 'rgba(53, 178, 136, 0.12)'
    },
    code: {
        color: '#F8FAFC',
        fontWeight: 'bold',
        width: 48
    },
    selectedText: {
        color: '#35b288'
    },
    sample: {
        color: '#94A3B8',
        flex: 1
    }
});
