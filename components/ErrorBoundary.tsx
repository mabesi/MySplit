import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../i18n/translations';
import { logger } from '../utils/logger';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * Catches unhandled render/lifecycle errors so the app shows a friendly
 * message instead of a blank screen. Errors are still forwarded to the
 * centralized logger, which is the single place to plug a crash reporter.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        logger.error('[ErrorBoundary] Unhandled error:', error, info.componentStack);
    }

    private handleRetry = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <View style={styles.container}>
                <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
                <Text style={styles.title}>{i18n.t('somethingWentWrong')}</Text>
                <Text style={styles.message}>{i18n.t('unexpectedErrorMessage')}</Text>
                <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
                    <Text style={styles.buttonText}>{i18n.t('tryAgain')}</Text>
                </TouchableOpacity>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    title: {
        color: '#F8FAFC',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 16,
        textAlign: 'center',
    },
    message: {
        color: '#94A3B8',
        fontSize: 15,
        lineHeight: 22,
        marginTop: 8,
        textAlign: 'center',
    },
    button: {
        marginTop: 24,
        backgroundColor: '#35b288',
        borderRadius: 12,
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    buttonText: {
        color: 'white',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
