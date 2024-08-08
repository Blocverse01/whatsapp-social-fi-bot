import { isAddress } from 'viem';
import { SupportedChain } from '@/app/WalletKit/walletKitSchema';

export const validateWalletAddress = (address: string, network: SupportedChain): boolean => {
    const networkFamily = getNetworkFamily(network);

    if (networkFamily === 'evm') {
        return isAddress(address);
    }

    throw new Error('Unsupported network family');
};

export const getNetworkFamily = (network: SupportedChain): 'evm' => {
    switch (network) {
        case 'Base':
            return 'evm';
        case 'Ethereum':
            return 'evm';
        case 'Optimism':
            return 'evm';
        case 'Polygon':
            return 'evm';
        default:
            throw new Error('Unsupported network');
    }
};
