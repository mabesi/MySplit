import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "MySplit",
    slug: "mysplit",
    scheme: "mysplit",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    jsEngine: 'hermes',
    splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#0F172A"
    },
    ios: {
        supportsTablet: true
    },
    android: {
        package: "com.mabesi.mysplit",
        versionCode: 2,
        adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#0F172A"
        },
        edgeToEdgeEnabled: true
    },
    web: {
        favicon: "./assets/favicon.png"
    },
    plugins: [
        "expo-router",
        [
            "react-native-google-mobile-ads",
            {
                androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713",
                iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || "ca-app-pub-3940256099942544~1458002511"
            }
        ]
    ],
    extra: {
        router: {},
        eas: {
            projectId: "6700bc3f-20b2-4d7d-8364-a04fdf881a2e"
        }
    }
});
