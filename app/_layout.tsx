import { Stack, useRouter, useSegments } from 'expo-router';
import { GroupProvider } from '../context/GroupContext';
import { ConfigProvider } from '../context/ConfigContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { Platform, Linking } from 'react-native';
import i18n from '../i18n/translations';

// Safe native module loader for mobileAds
const getMobileAds = () => {
    if (Platform.OS !== 'web') {
        try {
            return require('react-native-google-mobile-ads').default;
        } catch {
            return null;
        }
    }
    return null;
};

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        // Initialize Google Mobile Ads only on native platforms where supported
        const mobileAds = getMobileAds();
        if (mobileAds) {
            mobileAds()
                .initialize()
                .then((adapterStatuses: any) => {
                    // AdMob initialized
                })
                .catch((error: any) => {
                    console.error('❌ AdMob initialization error:', error);
                });
        }

        if (Platform.OS === 'android') {
            NavigationBar.setStyle('dark');
        }
    }, []);

    // Handle deep links
    useEffect(() => {
        const handleDeepLink = (event: { url: string }) => {
            const url = event.url;

            // Parse the URL: mysplit://join?groupId=xxx
            if (url.includes('mysplit://join')) {
                const groupId = url.split('groupId=')[1];
                if (groupId) {
                    // Navigate to home with the group ID
                    router.push(`/?joinGroupId=${groupId}`);
                }
            }
        };

        // Handle initial URL (app opened from link)
        Linking.getInitialURL().then((url) => {
            if (url) {
                handleDeepLink({ url });
            }
        });

        // Handle URL when app is already open
        const subscription = Linking.addEventListener('url', handleDeepLink);

        return () => {
            subscription.remove();
        };
    }, []);

    return (
        <SafeAreaProvider>
            <ConfigProvider>
                <GroupProvider>
                    <Stack screenOptions={{
                        headerStyle: { backgroundColor: '#35b288' }, // Primary Green
                        headerTintColor: '#fff',
                        headerTitleStyle: { fontWeight: 'bold' },
                    }}>
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                        <Stack.Screen name="group/[id]" options={{ title: i18n.t('groupDetails') }} />
                    </Stack>
                </GroupProvider>
            </ConfigProvider>
        </SafeAreaProvider>
    );
}
