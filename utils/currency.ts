import { parseAmountToMinor } from './number';

/**
 * Global currency support:
 * - the currency belongs to the group (one currency per group);
 * - amounts are stored as integer minor units;
 * - the app locale only controls separators/symbol placement.
 */

export const DEFAULT_CURRENCY = 'BRL';

// BRL (the app's primary currency) followed by the five most used currencies
// worldwide, ordered from most to least important.
export const FEATURED_CURRENCIES = ['BRL', 'USD', 'EUR', 'JPY', 'GBP', 'CNY'];

export type CurrencyOption = { code: string; label: string };

export interface CurrencySection {
    titleKey: 'mainCurrencies' | 'otherCurrencies';
    data: CurrencyOption[];
}

// Current ISO 4217 codes exposed by Intl. Kept as a static list because Hermes
// may not implement Intl.supportedValuesOf. Unknown 3-letter codes are still
// accepted and let Intl decide how to format them.
export const CURRENCY_CODES = [
    'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
    'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
    'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
    'COP', 'CRC', 'CUC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD',
    'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP',
    'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR',
    'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS',
    'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR',
    'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP',
    'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
    'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN',
    'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG',
    'SEK', 'SGD', 'SHP', 'SLE', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SVC',
    'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD',
    'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST',
    'XAF', 'XCD', 'XCG', 'XDR', 'XOF', 'XPF', 'XSU', 'YER', 'ZAR', 'ZMW',
    'ZWG', 'ZWL'
];

export function normalizeCurrency(currency?: string): string {
    const code = (currency || '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY;
}

export function getCurrencyFractionDigits(currency: string): number {
    try {
        const digits = new Intl.NumberFormat('en', {
            style: 'currency',
            currency: normalizeCurrency(currency)
        }).resolvedOptions().maximumFractionDigits;
        return typeof digits === 'number' ? digits : 2;
    } catch {
        return 2;
    }
}

export function toMinorUnits(amount: number, currency: string): number {
    const factor = 10 ** getCurrencyFractionDigits(currency);
    return Math.round((Number(amount) || 0) * factor);
}

export function fromMinorUnits(minor: number, currency: string): number {
    const factor = 10 ** getCurrencyFractionDigits(currency);
    return (Number(minor) || 0) / factor;
}

export function formatCurrencyMinor(minor: number, currency: string, locale: string = 'en'): string {
    const code = normalizeCurrency(currency);
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: code
        }).format(fromMinorUnits(minor, code));
    } catch {
        return fromMinorUnits(minor, code).toFixed(getCurrencyFractionDigits(code));
    }
}

export function formatCurrencyAmount(amount: number, currency: string, locale: string = 'en'): string {
    return formatCurrencyMinor(toMinorUnits(amount, currency), currency, locale);
}

/**
 * Parses a localized amount and returns it in minor units. Returns null for
 * invalid input or values that round to zero.
 */
export function parseCurrencyAmount(input: string, currency: string): number | null {
    const minor = parseAmountToMinor(input, getCurrencyFractionDigits(currency));
    return minor !== null && minor > 0 ? minor : null;
}

export function getCurrencyOptions(locale: string = 'en'): CurrencyOption[] {
    return CURRENCY_CODES.map(code => ({
        code,
        label: `${code} — ${formatCurrencyAmount(1234.56, code, locale)}`
    }));
}

export function getCurrencySections(locale: string = 'en'): CurrencySection[] {
    const options = getCurrencyOptions(locale);
    const byCode = new Map(options.map(option => [option.code, option]));

    const main = FEATURED_CURRENCIES
        .map(code => byCode.get(code))
        .filter((option): option is CurrencyOption => Boolean(option));

    const other = options
        .filter(option => !FEATURED_CURRENCIES.includes(option.code))
        .sort((a, b) => a.code.localeCompare(b.code));

    return [
        { titleKey: 'mainCurrencies', data: main },
        { titleKey: 'otherCurrencies', data: other }
    ];
}
