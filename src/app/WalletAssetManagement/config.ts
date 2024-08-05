import { SupportedChain } from '@/app/WalletKit/walletKitSchema';

type NetworkTransactionFeeConfig = {
    minimumFee: number;
    maximumFee: number;
    feeThreshold: number;
    feePerThreshold: number;
};

/**
 * @description Fee configuration for stable token transfer on different networks. Stable token tokens are tokens like USDC, USDT, etc.
 * */
export const networkStableTokenTransferFeeConfig: Record<
    SupportedChain,
    NetworkTransactionFeeConfig
> = {
    Base: {
        minimumFee: 0.01, // 0.01 USDT | USDC
        maximumFee: 0.5,
        feeThreshold: 10,
        feePerThreshold: 0.001, // 0.001 for every 10 USDT | USDC
    },
    Polygon: {
        minimumFee: 0.1, // 0.1 USDT | USDC
        maximumFee: 0.5,
        feeThreshold: 10,
        feePerThreshold: 0.001, // 0.001 for every 10 USDT | USDC
    },
    Optimism: {
        minimumFee: 0.2, // 0.2 USDT | USDC
        maximumFee: 0.5,
        feeThreshold: 10,
        feePerThreshold: 0.001, // 0.001 for every 10 USDT | USDC
    },
    Ethereum: {
        minimumFee: 20, // 20 USDT | USDC
        maximumFee: 50,
        feeThreshold: 10,
        feePerThreshold: 0.2, // 0.2 for every 10 USDT | USDC
    },
};

export function calculateStableTokenTransferTransactionFee(
    chain: SupportedChain,
    amount: number
): number {
    const config = networkStableTokenTransferFeeConfig[chain];
    const { minimumFee, maximumFee, feeThreshold, feePerThreshold } = config;

    const numberOfThresholds = Math.floor(amount / feeThreshold);
    const calculatedFee = numberOfThresholds * feePerThreshold;

    let appliedFee = calculatedFee;

    if (calculatedFee < minimumFee) {
        appliedFee = minimumFee;
    } else if (calculatedFee > maximumFee) {
        appliedFee = maximumFee;
    }

    return appliedFee;
}
