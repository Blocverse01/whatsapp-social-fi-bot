import env from '@/constants/env';
import { DUMMY_ETH_PRICE, DUMMY_MATIC_PRICE, DUMMY_USD_PRICE } from '@/constants/numbers';

export enum TokenAddresses {
    USDT_MATIC_MAINNET = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDT_MATIC_TESTNET = '0x1616d425Cd540B256475cBfb604586C8598eC0FB',
    USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDC_BASE_TESTNET = '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
}

export enum TokenNames {
    USDT_MATIC = 'USDT (MATIC)',
    USDC_BASE = 'USDC (BASE)',
    MATIC = 'MATIC',
    ETH = 'ETH (BASE)',
}

export const usdtPolygonConfig = {
    tokenAddress:
        env.WEB3_ENVIRONMENT === 'testnet'
            ? TokenAddresses.USDT_MATIC_TESTNET
            : TokenAddresses.USDT_MATIC_MAINNET,
    tokenName: TokenNames.USDT_MATIC,
    listItemId: 'explore-usdt-polygon',
    network: 'Polygon' as const,
};
export const usdcBaseConfig = {
    tokenAddress:
        env.WEB3_ENVIRONMENT === 'testnet'
            ? TokenAddresses.USDC_BASE_TESTNET
            : TokenAddresses.USDC_BASE_MAINNET,
    tokenName: TokenNames.USDC_BASE,
    listItemId: 'explore-usdc-base',
    network: 'Base' as const,
};
export const maticConfig = {
    tokenName: TokenNames.MATIC,
    listItemId: 'explore-matic',
    tokenAddress: 'MATIC',
    network: 'Polygon' as const,
};
export const ethConfig = {
    tokenName: TokenNames.ETH,
    listItemId: 'explore-eth',
    tokenAddress: 'ETH',
    network: 'Base' as const,
};

export const getDummyUsdValue = (tokenName: TokenNames) => {
    switch (tokenName) {
        case TokenNames.USDT_MATIC:
            return DUMMY_USD_PRICE;
        case TokenNames.USDC_BASE:
            return DUMMY_USD_PRICE;
        case TokenNames.MATIC:
            return DUMMY_MATIC_PRICE;
        case TokenNames.ETH:
            return DUMMY_ETH_PRICE;
        default:
            return 0.0;
    }
};
