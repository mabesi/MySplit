export const useRewardedAd = () => {
    return {
        loaded: false,
        rewardReceived: false,
        showAd: () => {
            console.warn('AdMob is not supported on web.');
        },
        error: null,
        resetReward: () => {}
    };
};
