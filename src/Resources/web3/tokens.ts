import env from '@/constants/env';

export enum TokenAddresses {
    USDT_MATIC_MAINNET = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDT_MATIC_TESTNET = '0x1616d425Cd540B256475cBfb604586C8598eC0FB',
    USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDC_BASE_TESTNET = '0xd74cc5d436923b8ba2c179b4bCA2841D8A52C5B5',
}

export enum TokenNames {
    USDT_MATIC = 'USDT(MATIC)',
    USDC_BASE = 'USDC(BASE)',
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
};
export const usdcBaseConfig = {
    tokenAddress:
        env.WEB3_ENVIRONMENT === 'testnet'
            ? TokenAddresses.USDC_BASE_TESTNET
            : TokenAddresses.USDC_BASE_MAINNET,
    tokenName: TokenNames.USDC_BASE,
    listItemId: 'explore-usdc-base',
};
export const maticConfig = {
    tokenName: TokenNames.MATIC,
    listItemId: 'explore-matic',
};
export const ethConfig = {
    tokenName: TokenNames.ETH,
    listItemId: 'explore-eth',
};
