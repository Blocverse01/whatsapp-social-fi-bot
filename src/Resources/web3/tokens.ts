import env from '@/constants/env';
import { DUMMY_ETH_PRICE, DUMMY_MATIC_PRICE, DUMMY_USD_PRICE } from '@/constants/numbers';
import { AssetInteractiveButtonIds } from '@/app/WhatsAppBot/WhatsAppBotType';
import { SupportedChain } from '@/app/WalletKit/walletKitSchema';

export enum TokenAddresses {
    /**
     * Polygon Asset Addresses
     */
    // USDC
    USDC_MATIC_MAINNET = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDC_MATIC_TESTNET = '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582',

    // USDT
    USDT_MATIC_MAINNET = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDT_MATIC_TESTNET = '0x1616d425Cd540B256475cBfb604586C8598eC0FB',

    /**
     * Base Asset Addresses
     */
    // USDC
    USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDC_BASE_TESTNET = '0x036CbD53842c5426634e7929541eC2318f3dCF7e',

    /**
     * Ethereum Asset Addresses
     */
    // USDC
    USDC_ETH_MAINNET = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDC_ETH_SEPOLIA_TESTNET = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',

    // USDT
    USDT_ETH_MAINNET = '0xdac17f958d2ee523a2206206994597c13d831ec7',
    USDT_ETH_SEPOLIA_TESTNET = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',

    /**
     * Optimism Asset Addresses
     */
    // USDC
    USDC_OPTIMISM_MAINNET = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    USDC_OPTIMISM_SEPOLIA_TESTNET = '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',

    // USDT
    USDT_OPTIMISM_MAINNET = '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    USDT_OPTIMISM_SEPOLIA_TESTNET = '0xf884B63217D3427677c7b045370Bb269FabF1FA7',
}

export enum TokenNames {
    USDT = 'USDT',
    USDC = 'USDC',
    MATIC = 'MATIC',
    ETH = 'ETH',
}

export type AssetConfig = {
    tokenAddress: string;
    tokenName: TokenNames;
    listItemId: string;
    network: SupportedChain;
};

// Asset Configurations
// Polygon Assets
/// ============== USDC ==============
export const usdcPolygonConfig = {
    tokenAddress:
        env.WEB3_ENVIRONMENT === 'testnet'
            ? TokenAddresses.USDC_MATIC_TESTNET
            : TokenAddresses.USDC_MATIC_MAINNET,
    tokenName: TokenNames.USDC,
    listItemId: AssetInteractiveButtonIds.USDC_POLYGON,
    network: 'Polygon' as const,
} satisfies AssetConfig;
/// ============== USDT ==============
export const usdtPolygonConfig = {
    tokenAddress:
        env.WEB3_ENVIRONMENT === 'testnet'
            ? TokenAddresses.USDT_MATIC_TESTNET
            : TokenAddresses.USDT_MATIC_MAINNET,
    tokenName: TokenNames.USDT,
    listItemId: AssetInteractiveButtonIds.USDT_POLYGON,
    network: 'Polygon' as const,
} satisfies AssetConfig;
/// ============== MATIC ==============
export const maticConfig = {
    tokenName: TokenNames.MATIC,
    listItemId: AssetInteractiveButtonIds.MATIC_POLYGON,
    tokenAddress: 'MATIC',
    network: 'Polygon' as const,
} satisfies AssetConfig;

// Base Assets
/// ============== USDC ==============
export const usdcBaseConfig = {
    tokenAddress:
        env.WEB3_ENVIRONMENT === 'testnet'
            ? TokenAddresses.USDC_BASE_TESTNET
            : TokenAddresses.USDC_BASE_MAINNET,
    tokenName: TokenNames.USDC,
    listItemId: AssetInteractiveButtonIds.USDC_BASE,
    network: 'Base' as const,
} satisfies AssetConfig;
/// ============== ETH ==============
export const ethBaseConfig = {
    tokenName: TokenNames.ETH,
    listItemId: AssetInteractiveButtonIds.ETH_BASE,
    tokenAddress: 'ETH',
    network: 'Base' as const,
} satisfies AssetConfig;

// Ethereum Assets
/// ============== USDC ==============
export const usdcEthConfig = {
    tokenAddress:
        env.WEB3_ENVIRONMENT === 'testnet'
            ? TokenAddresses.USDC_ETH_SEPOLIA_TESTNET
            : TokenAddresses.USDC_ETH_MAINNET,
    tokenName: TokenNames.USDC,
    listItemId: AssetInteractiveButtonIds.USDC_ETH,
    network: 'Ethereum' as const,
} satisfies AssetConfig;
/// ============== USDT ==============
export const usdtEthConfig = {
    tokenAddress:
        env.WEB3_ENVIRONMENT === 'testnet'
            ? TokenAddresses.USDT_ETH_SEPOLIA_TESTNET
            : TokenAddresses.USDT_ETH_MAINNET,
    tokenName: TokenNames.USDT,
    listItemId: AssetInteractiveButtonIds.USDT_ETH,
    network: 'Ethereum' as const,
} satisfies AssetConfig;

// Optimism Assets
/// ============== USDC ==============
export const usdcOptimismConfig = {
    tokenAddress:
        env.WEB3_ENVIRONMENT === 'testnet'
            ? TokenAddresses.USDC_OPTIMISM_SEPOLIA_TESTNET
            : TokenAddresses.USDC_OPTIMISM_MAINNET,
    tokenName: TokenNames.USDC,
    listItemId: AssetInteractiveButtonIds.USDC_OPTIMISM,
    network: 'Optimism' as const,
} satisfies AssetConfig;
/// ============== USDT ==============
export const usdtOptimismConfig = {
    tokenAddress:
        env.WEB3_ENVIRONMENT === 'testnet'
            ? TokenAddresses.USDT_OPTIMISM_SEPOLIA_TESTNET
            : TokenAddresses.USDT_OPTIMISM_MAINNET,
    tokenName: TokenNames.USDT,
    listItemId: AssetInteractiveButtonIds.USDT_OPTIMISM,
    network: 'Optimism' as const,
} satisfies AssetConfig;

// Dummy USD value for testing
export const getDummyUsdValue = (tokenName: TokenNames) => {
    switch (tokenName) {
        case TokenNames.USDT:
            return DUMMY_USD_PRICE;
        case TokenNames.USDC:
            return DUMMY_USD_PRICE;
        case TokenNames.MATIC:
            return DUMMY_MATIC_PRICE;
        case TokenNames.ETH:
            return DUMMY_ETH_PRICE;
        default:
            return 0.0;
    }
};
