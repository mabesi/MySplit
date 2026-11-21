import { logger } from '../utils/logger';
import { useEffect, useState, useRef } from 'react';
import { RewardedAd, AdEventType, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { useConfig } from '../context/ConfigContext';

// Official Google test ad ID for rewarded ads
// This is more reliable than TestIds.REWARDED
const TEST_AD_ID = 'ca-app-pub-3940256099942544/5224354917';

export const useRewardedAd = () => {
    const { realAds, loading } = useConfig();
    const [loaded, setLoaded] = useState(false);
    const [rewardReceived, setRewardReceived] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const adShownRef = useRef(false);
    const rewardedRef = useRef<RewardedAd | null>(null);

    // Determine Ad Unit ID based on config
    // ALWAYS use test ID if realAds is false or config is still loading
    const adUnitId = (realAds && !loading)
        ? (process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || TEST_AD_ID)
        : TEST_AD_ID;

    useEffect(() => {
        logger.debug('🎬 Initializing rewarded ad...');
        logger.debug(`📱 Ad Unit ID: ${adUnitId}`);
        logger.debug(`🎯 Real Ads Mode: ${realAds}`);
        logger.debug(`⏳ Config Loading: ${loading}`);
        logger.debug(`🔑 Env Ad ID: ${process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || 'NOT SET'}`);

        // Create the ad instance
        const rewarded = RewardedAd.createForAdRequest(adUnitId, {
            requestNonPersonalizedAdsOnly: true,
        });

        rewardedRef.current = rewarded;

        const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
            logger.debug('✅ Ad loaded successfully');
            setLoaded(true);
            setError(null);
        });

        const unsubscribeEarned = rewarded.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            reward => {
                logger.debug('🎁 User earned reward:', reward);
                setRewardReceived(true);
            },
        );

        const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
            logger.debug('🚪 Ad closed');
            setLoaded(false);

            // If ad was shown, mark reward as received
            if (adShownRef.current) {
                logger.debug('✅ Setting reward as received');
                // Use setTimeout to ensure state update happens after ad closes
                setTimeout(() => {
                    setRewardReceived(true);
                    adShownRef.current = false;
                }, 100);
            }

            // Reload ad for next time
            logger.debug('🔄 Reloading ad...');
            rewarded.load();
        });

        const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
            logger.error('❌ Ad error:', error);
            logger.error('❌ Error code:', (error as any).code);
            logger.error('❌ Error message:', error.message);
            setError('Failed to load ad');
            setLoaded(false);
            // Try to reload after error
            setTimeout(() => {
                logger.debug('🔄 Retrying ad load after error...');
                rewarded.load();
            }, 5000);
        });

        // Start loading the ad after a small delay to ensure AdMob is ready
        setTimeout(() => {
            logger.debug('📥 Starting to load ad...');
            rewarded.load();
        }, 1000);

        // Unsubscribe from events on unmount
        return () => {
            logger.debug('🧹 Cleaning up ad listeners');
            unsubscribeLoaded();
            unsubscribeEarned();
            unsubscribeClosed();
            unsubscribeError();
            rewardedRef.current = null;
        };
    }, [adUnitId, realAds, loading]); // Re-run if adUnitId, realAds, or loading changes

    const showAd = () => {
        if (loaded && rewardedRef.current) {
            logger.debug('🎬 Showing ad...');
            adShownRef.current = true; // Mark that we're showing the ad
            rewardedRef.current.show();
        } else {
            logger.warn('⚠️ Ad not loaded yet or ref is null');
            logger.warn(`⚠️ Loaded: ${loaded}, Ref: ${rewardedRef.current ? 'exists' : 'null'}`);
        }
    };

    const resetReward = () => {
        // Resetting reward state
        setRewardReceived(false);
    };

    return { loaded, rewardReceived, showAd, error, resetReward };
};
