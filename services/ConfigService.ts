export interface AppConfig {
    realAds: boolean;
    launched: string;
    updated: string;
}

interface RemoteConfig {
    mysplit: AppConfig;
    // other apps...
}

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || 'https://mabesi.github.io/apps';
const CONFIG_URL = `${BASE_URL}/appconfig.json`;

export const ConfigService = {
    fetchConfig: async (): Promise<AppConfig | null> => {
        try {
            const response = await fetch(CONFIG_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: RemoteConfig = await response.json();
            return data.mysplit;
        } catch (error) {
            console.error("Failed to fetch app config:", error);
            return null;
        }
    }
};
