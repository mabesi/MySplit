import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: ViewStyle;
    contentContainerStyle?: ViewStyle;
    useBottomInset?: boolean;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children, style, useBottomInset = true }) => {
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (Platform.OS === 'android') {
            NavigationBar.setStyle('dark');
        }
    }, []);

    return (
        <View style={[styles.container, style]}>
            <StatusBar style="light" />

            {/* Background Gradient */}
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                style={StyleSheet.absoluteFill}
            />

            {/* Content Container with Safe Area Padding */}
            <View style={[
                styles.content,
                {
                    paddingTop: insets.top,
                    paddingBottom: useBottomInset ? insets.bottom : 0,
                    paddingLeft: insets.left,
                    paddingRight: insets.right,
                }
            ]}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    content: {
        flex: 1,
    },
});
