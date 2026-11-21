/**
 * Centralized logger.
 *
 * Debug/info messages are development-only. Warnings and errors are kept in
 * production because they are useful for diagnosing real failures.
 */
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

export const logger = {
    debug: (...args: any[]) => {
        if (isDev) console.log(...args);
    },
    info: (...args: any[]) => {
        if (isDev) console.log(...args);
    },
    warn: (...args: any[]) => {
        console.warn(...args);
    },
    error: (...args: any[]) => {
        console.error(...args);
    }
};
