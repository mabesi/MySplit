import { logger } from '../utils/logger';
export const useRewardedAd = () => {
    return {
        loaded: false,
        rewardReceived: false,
        showAd: () => {
            logger.warn('AdMob is not supported on web.');
        },
        error: null,
        resetReward: () => {}
    };
};
