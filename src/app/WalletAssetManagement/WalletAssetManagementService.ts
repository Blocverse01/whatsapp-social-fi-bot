import { UserAssetItem } from '@/app/User/userSchema';
import WalletKitService from '@/app/WalletKit/WalletKitService';
import env from '@/constants/env';
import { fixNumber } from '@/Resources/utils/currency';
import { TEN, TWO } from '@/constants/numbers';
import { SupportedChain } from '@/app/WalletKit/walletKitSchema';
import { isAddress } from 'viem';
import { calculateStableTokenTransferTransactionFee } from '@/app/WalletAssetManagement/config';

class WalletAssetManagementService {
    public static async transferUserAssetToWallet(
        asset: UserAssetItem,
        walletAddress: string,
        amount: string
    ) {
        if (!isAddress(asset.tokenAddress)) {
            throw new Error('Only Tokens are supported for transfer at the moment');
        }

        const transactionFee = this.calculateStableTokenTransferTransactionFee(
            amount,
            asset.network
        );
        const totalAmount = fixNumber(Number(amount) + transactionFee, TWO);

        return await WalletKitService.transferToken({
            amount: totalAmount.toString(TEN),
            network: asset.network,
            developer_secret: env.WALLET_KIT_DEVELOPER_SECRET,
            token: asset.tokenAddress,
            from: asset.walletAddress,
            recipient: walletAddress,
        });
    }

    public static calculateStableTokenTransferTransactionFee(
        amount: string,
        network: SupportedChain
    ) {
        return fixNumber(calculateStableTokenTransferTransactionFee(network, Number(amount)), TWO);
    }
}

export default WalletAssetManagementService;
