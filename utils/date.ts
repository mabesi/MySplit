const DATE_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Returns the device-local calendar date as YYYY-MM-DD.
 * Do not use toISOString() for this: it is UTC and can return tomorrow/yesterday.
 */
export function toDateInputValue(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function isValidDateInput(value: string): boolean {
    const match = DATE_INPUT_RE.exec(value.trim());
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);

    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;
}

/**
 * Parses YYYY-MM-DD using local components at noon. Noon avoids DST transitions
 * and keeps the calendar date stable for the picker.
 */
export function parseDateInput(value: string): Date {
    const match = DATE_INPUT_RE.exec(value.trim());
    if (!match) return new Date();

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);

    return isValidDateInput(value) ? date : new Date();
}

/**
 * Derives a calendar date for legacy expenses that only have the old UTC
 * midnight timestamp. Those timestamps were created from YYYY-MM-DD inputs,
 * so the UTC date is the intended calendar date.
 */
export function dateStringFromTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return toDateInputValue();
    return date.toISOString().slice(0, 10);
}

/**
 * Returns the calendar date of an expense, preferring the persisted
 * `dateString` and falling back to the legacy timestamp.
 */
export function expenseDateString(expense: {
    date?: number;
    dateString?: string;
    createdAt?: number;
}): string {
    if (expense.dateString && isValidDateInput(expense.dateString)) {
        return expense.dateString;
    }
    if (typeof expense.date === 'number') {
        return dateStringFromTimestamp(expense.date);
    }
    if (typeof expense.createdAt === 'number') {
        return dateStringFromTimestamp(expense.createdAt);
    }
    return toDateInputValue();
}

/**
 * Formats a YYYY-MM-DD calendar date for display without any timezone shift.
 */
export function formatDateString(value: string, locale: string = 'en'): string {
    if (!isValidDateInput(value)) return value;

    const date = parseDateInput(value);
    try {
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date);
    } catch {
        return value;
    }
}
