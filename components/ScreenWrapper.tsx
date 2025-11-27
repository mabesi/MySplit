import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, StatusBar, ViewStyle } from 'react-native';
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
            // Make navigation bar transparent and content draw behind it
            NavigationBar.setPositionAsync('absolute');
            NavigationBar.setBackgroundColorAsync('#00000000');
            NavigationBar.setButtonStyleAsync('light'); // White icons
        }
    }, []);

    return (
        <View style={[styles.container, style]}>
            <StatusBar
                barStyle="light-content"
                backgroundColor="transparent"
                translucent={true}
            />

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
