import { getLocales } from 'expo-localization';
import { DEFAULT_CURRENCY } from './currency';

export function getDeviceCurrency(): string {
    try {
        const code = getLocales()[0]?.currencyCode;
        if (code && /^[A-Z]{3}$/.test(code.toUpperCase())) {
            return code.toUpperCase();
        }
    } catch (error) {
        console.warn('[Currency] Could not read the device currency:', error);
    }
    return DEFAULT_CURRENCY;
}
