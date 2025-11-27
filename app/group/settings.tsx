import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, ScrollView, Share } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useGroup } from '../../context/GroupContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import i18n from '../../i18n/translations';
import { ScreenWrapper } from '../../components/ScreenWrapper';

export default function SettingsScreen() {
    const router = useRouter();
    const { currentGroup, updateGroupImage, deleteGroup, userId, isLoading } = useGroup();
    const [imageUrl, setImageUrl] = useState('');

    if (!currentGroup) return null;

    const isOwner = currentGroup.ownerId === userId;

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5, // Compress here
            base64: true, // Get base64 directly
            presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            if (asset.base64) {
                // Create Data URI
                const dataUri = `data:image/jpeg;base64,${asset.base64}`;
                setImageUrl(dataUri);
            }
        }
    };

    const handleUpdateImage = async () => {
        if (!imageUrl) return;
        await updateGroupImage(imageUrl);
        setImageUrl('');
        Alert.alert(i18n.t('success') || 'Success', i18n.t('imageUpdated') || 'Group image updated');
    };

    const handleShareGroup = async () => {
        try {
            // Copy group ID to clipboard first
            await Clipboard.setStringAsync(currentGroup.id);

            const message = i18n.t('shareGroupMessage', { groupName: currentGroup.name });
            const instructions = i18n.t('shareInstructions') || 'Open MySplit app and use this Group ID to join:';

            await Share.share({
                message: `${message}\n\n${instructions}`,
                title: i18n.t('shareGroup')
            });

            // Show confirmation that ID was copied
            Alert.alert(
                i18n.t('groupIdCopied') || 'Group ID Copied!',
                i18n.t('groupIdCopiedMessage') || 'The Group ID has been copied to your clipboard. You can paste it in the next message.',
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error sharing group:', error);
        }
    };

    const handleDeleteGroup = () => {
        Alert.alert(
            i18n.t('deleteGroup'),
            i18n.t('confirmDeleteGroup'),
            [
                { text: i18n.t('cancel'), style: 'cancel' },
                {
                    text: i18n.t('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        await deleteGroup();
                        router.replace('/');
                    }
                }
            ]
        );
    };

    return (
        <ScreenWrapper>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{i18n.t('groupSettings')}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Group Image */}
                {isOwner && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{i18n.t('updateImage')}</Text>
                        <View style={styles.card}>
                            <View style={styles.imageRow}>
                                <TouchableOpacity onPress={pickImage} style={styles.imagePlaceholder}>
                                    {imageUrl || currentGroup.imageUrl ? (
                                        <Image source={{ uri: imageUrl || currentGroup.imageUrl }} style={styles.image} />
                                    ) : (
                                        <Ionicons name="image-outline" size={32} color="#94A3B8" />
                                    )}
                                    <View style={styles.editBadge}>
                                        <Ionicons name="pencil" size={12} color="white" />
                                    </View>
                                </TouchableOpacity>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={styles.cardTitle}>{i18n.t('groupIcon')}</Text>
                                    <Text style={styles.cardSubtitle}>{i18n.t('tapToChange')}</Text>
                                </View>
                            </View>
                            {imageUrl && (
                                <TouchableOpacity
                                    style={[styles.saveButton, isLoading && { opacity: 0.7 }]}
                                    onPress={handleUpdateImage}
                                    disabled={isLoading}
                                >
                                    <Text style={styles.saveButtonText}>
                                        {isLoading ? (i18n.t('uploading') || 'Uploading...') : i18n.t('saveImage')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Members Navigation */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{i18n.t('management')}</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/group/members')}>
                            <View style={styles.menuIcon}>
                                <Ionicons name="people-outline" size={20} color="#6366F1" />
                            </View>
                            <Text style={styles.menuText}>{i18n.t('members')}</Text>
                            <Ionicons name="chevron-forward" size={20} color="#64748B" />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.menuItem} onPress={handleShareGroup}>
                            <View style={styles.menuIcon}>
                                <Ionicons name="share-outline" size={20} color="#35b288" />
                            </View>
                            <Text style={styles.menuText}>{i18n.t('shareGroup') || 'Share Group'}</Text>
                            <Ionicons name="chevron-forward" size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Danger Zone */}
                {isOwner && (
                    <View style={styles.section}>
                        <View style={[styles.card, { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }]}>
                            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteGroup}>
                                <View style={[styles.menuIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                </View>
                                <Text style={[styles.menuText, { color: '#EF4444' }]}>{i18n.t('deleteGroup')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
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
        paddingVertical: 12,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC' },
    content: { flex: 1, padding: 16 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
    card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
    imageRow: { flexDirection: 'row', alignItems: 'center' },
    imagePlaceholder: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
    image: { width: 64, height: 64, borderRadius: 20 },
    editBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#6366F1', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1E293B' },
    cardTitle: { fontSize: 16, fontWeight: '600', color: '#F8FAFC' },
    cardSubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
    saveButton: { marginTop: 16, backgroundColor: '#35b288', padding: 12, borderRadius: 12, alignItems: 'center' },
    saveButtonText: { color: 'white', fontWeight: 'bold' },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    menuText: { flex: 1, fontSize: 16, color: '#F8FAFC', fontWeight: '500' },
    divider: { height: 1, backgroundColor: '#334155', marginVertical: 12 },
});
