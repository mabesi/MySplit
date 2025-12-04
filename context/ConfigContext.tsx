import React, { createContext, useContext, useEffect, useState } from 'react';
import { ConfigService, AppConfig } from '../services/ConfigService';

interface ConfigContextType extends AppConfig {
    loading: boolean;
}

const defaultConfig: AppConfig = {
    realAds: false,
    launched: '2025-12-04', // Fallback
    updated: '2025-12-04'  // Fallback
};

const ConfigContext = createContext<ConfigContextType>({
    ...defaultConfig,
    loading: true
});

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<AppConfig>(defaultConfig);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadConfig = async () => {
            const remoteConfig = await ConfigService.fetchConfig();
            if (remoteConfig) {
                setConfig(remoteConfig);
            }
            setLoading(false);
        };

        loadConfig();
    }, []);

    return (
        <ConfigContext.Provider value={{ ...config, loading }}>
            {children}
        </ConfigContext.Provider>
    );
};
