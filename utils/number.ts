/**
 * Parses user-entered monetary values in both comma-decimal (1.234,56) and
 * dot-decimal (1,234.56) formats.
 *
 * The last separator is treated as the decimal separator; any earlier
 * separators are treated as thousands separators. Returns null for invalid
 * input instead of silently truncating it.
 */
function normalizeAmountString(input: string): string | null {
    const value = input.trim().replace(/\s/g, '');
    if (!value) return null;

    const lastComma = value.lastIndexOf(',');
    const lastDot = value.lastIndexOf('.');
    const commaCount = (value.match(/,/g) || []).length;
    const dotCount = (value.match(/\./g) || []).length;

    let normalized: string;

    if (commaCount > 0 && dotCount > 0) {
        // Both separators present: the last one is the decimal separator.
        if (lastComma > lastDot) {
            if (commaCount !== 1) return null;
            normalized = value.replace(/\./g, '').replace(',', '.');
        } else {
            if (dotCount !== 1) return null;
            normalized = value.replace(/,/g, '');
        }
    } else if (commaCount > 1) {
        // Only commas: accept 1,234,567 but reject 1,2,3.
        const parts = value.split(',');
        if (!parts.slice(1).every(part => part.length === 3)) return null;
        normalized = parts.join('');
    } else if (dotCount > 1) {
        // Only dots: accept 1.234.567 but reject 1.2.3.
        const parts = value.split('.');
        if (!parts.slice(1).every(part => part.length === 3)) return null;
        normalized = parts.join('');
    } else if (commaCount === 1) {
        normalized = value.replace(',', '.');
    } else {
        // Exactly one dot or no separator.
        normalized = value;
    }

    return /^\d+(\.\d+)?$/.test(normalized) ? normalized : null;
}

export function parseAmount(input: string): number | null {
    const normalized = normalizeAmountString(input);
    if (normalized === null) return null;

    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
}

/**
 * Parses a localized amount directly into minor units, rounding half-up to the
 * requested number of fraction digits. Avoids floating-point drift such as
 * 1.005 * 100 = 100.49999999999999.
 */
export function parseAmountToMinor(input: string, fractionDigits: number): number | null {
    const normalized = normalizeAmountString(input);
    if (normalized === null) return null;

    const digits = Math.max(0, Math.floor(fractionDigits));
    const [integerPart, fractionPart = ''] = normalized.split('.');
    const padded = (fractionPart + '0'.repeat(digits + 1)).slice(0, digits + 1);

    const whole = Number(integerPart || '0');
    let minor = whole * 10 ** digits + Number(padded.slice(0, digits) || '0');

    if (Number(padded[digits] || '0') >= 5) minor += 1;

    return minor;
}

/**
 * Formats a monetary value using the device/app locale. The currency symbol is
 * handled separately by the i18n layer.
 */
export function formatAmount(value: number, locale: string = 'en'): string {
    try {
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    } catch {
        return value.toFixed(2);
    }
}
