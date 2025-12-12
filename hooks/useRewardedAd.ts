import { useEffect, useState, useRef } from 'react';
import { RewardedAd, AdEventType, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useConfig } from '../context/ConfigContext';

export const useRewardedAd = () => {
    const { realAds } = useConfig();
    const [loaded, setLoaded] = useState(false);
    const [rewardReceived, setRewardReceived] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const adShownRef = useRef(false);
    const rewardedRef = useRef<RewardedAd | null>(null);

    // Determine Ad Unit ID based on config
    const adUnitId = realAds
        ? (process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || TestIds.REWARDED)
        : TestIds.REWARDED;

    useEffect(() => {
        console.log('🎬 Initializing rewarded ad...');
        console.log(`📱 Ad Unit ID: ${adUnitId}`);
        console.log(`🎯 Real Ads Mode: ${realAds}`);
        console.log(`🔑 Env Ad ID: ${process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || 'NOT SET'}`);

        // Create the ad instance
        const rewarded = RewardedAd.createForAdRequest(adUnitId, {
            requestNonPersonalizedAdsOnly: true,
        });

        rewardedRef.current = rewarded;

        const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
            console.log('✅ Ad loaded successfully');
            setLoaded(true);
            setError(null);
        });

        const unsubscribeEarned = rewarded.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            reward => {
                console.log('🎁 User earned reward:', reward);
                setRewardReceived(true);
            },
        );

        const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
            console.log('🚪 Ad closed');
            setLoaded(false);

            // If ad was shown, mark reward as received
            if (adShownRef.current) {
                console.log('✅ Setting reward as received');
                // Use setTimeout to ensure state update happens after ad closes
                setTimeout(() => {
                    setRewardReceived(true);
                    adShownRef.current = false;
                }, 100);
            }

            // Reload ad for next time
            console.log('🔄 Reloading ad...');
            rewarded.load();
        });

        const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
            console.error('❌ Ad error:', error);
            console.error('❌ Error code:', (error as any).code);
            console.error('❌ Error message:', error.message);
            setError('Failed to load ad');
            setLoaded(false);
            // Try to reload after error
            setTimeout(() => {
                console.log('🔄 Retrying ad load after error...');
                rewarded.load();
            }, 5000);
        });

        // Start loading the ad after a small delay to ensure AdMob is ready
        setTimeout(() => {
            console.log('📥 Starting to load ad...');
            rewarded.load();
        }, 1000);

        // Unsubscribe from events on unmount
        return () => {
            console.log('🧹 Cleaning up ad listeners');
            unsubscribeLoaded();
            unsubscribeEarned();
            unsubscribeClosed();
            unsubscribeError();
            rewardedRef.current = null;
        };
    }, [adUnitId, realAds]); // Re-run if adUnitId or realAds changes

    const showAd = () => {
        if (loaded && rewardedRef.current) {
            console.log('🎬 Showing ad...');
            adShownRef.current = true; // Mark that we're showing the ad
            rewardedRef.current.show();
        } else {
            console.warn('⚠️ Ad not loaded yet or ref is null');
            console.warn(`⚠️ Loaded: ${loaded}, Ref: ${rewardedRef.current ? 'exists' : 'null'}`);
        }
    };

    const resetReward = () => {
        // Resetting reward state
        setRewardReceived(false);
    };

    return { loaded, rewardReceived, showAd, error, resetReward };
};
