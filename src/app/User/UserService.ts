import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from '@/constants/status-codes';
import { dbClient } from '@/Db/dbClient';
import { HttpException } from '@/Resources/exceptions/HttpException';
import env from '@/constants/env';
import { CreateWalletKitWalletResponse, SUPPORTED_CHAINS } from '@/app/WalletKit/walletKitSchema';
import WalletKitService from '@/app/WalletKit/WalletKitService';
import { UserAssetItem } from '@/app/User/userSchema';
import {
    ethConfig,
    getDummyUsdValue,
    maticConfig,
    TokenNames,
    usdcBaseConfig,
    usdtPolygonConfig,
} from '@/Resources/web3/tokens';
import { Users } from 'walletkit-js/api/resources/users/client/Client';
import { Wallet } from 'walletkit-js/serialization';
import FiatRampService from '@/app/FiatRamp/FiatRampService';
import { parseUnits, toHex } from 'viem';

class UserService {
    private static USER_TABLE = dbClient.User;

    public static async createUser(phoneNumber: string, displayName: string) {
        try {
            const user = await this.getUser(phoneNumber);

            if (!user) {
                await this.USER_TABLE.create({
                    id: phoneNumber,
                    phoneNumber: phoneNumber,
                });

                return true;
            }

            return false;
        } catch (error) {
            throw new HttpException(INTERNAL_SERVER_ERROR, `User not found`);
        }
    }

    public static async getUserByMessageId(messageId: string) {
        const record = await this.USER_TABLE.filter({ messageId }).getFirst();
        return record;
    }

    public static async markMessageProcessed(messageId: string) {
        const record = await this.getUserByMessageId(messageId);
        if (record) {
            await record.update({ messageId: null });
        }
    }

    public static async getUser(phoneNumber: string) {
        const record = await this.USER_TABLE.filter({ phoneNumber }).getFirst();
        return !!record;
    }

    public static async createUserWallets(phoneNumber: string) {
        const [Polygon, Base] = SUPPORTED_CHAINS;

        const promises = [Polygon, Base].map((chain) =>
            WalletKitService.createUserWallet({
                name: `${chain} Wallet`,
                owner_id: phoneNumber,
                network: chain,
                control_mode: 'developer',
                type: 'contract',
                developer_secret: env.DEVELOPER_SECRET,
            })
        );

        return UserService.computeUserWalletAssetsList(await Promise.all(promises));
    }

    public static computeUserWalletAssetsList(
        userWallets: Array<CreateWalletKitWalletResponse>
    ): Array<UserAssetItem> {
        const baseWallet = userWallets.find((wallet) => wallet.network === 'Base');

        const polygonWallet = userWallets.find((wallet) => wallet.network === 'Polygon');

        const polygonAssets = polygonWallet
            ? [
                  {
                      listItemId: usdtPolygonConfig.listItemId,
                      walletAddress: polygonWallet.address,
                      name: usdtPolygonConfig.tokenName,
                      tokenAddress: usdtPolygonConfig.tokenAddress,
                      network: usdtPolygonConfig.network,
                  },
                  {
                      listItemId: maticConfig.listItemId,
                      walletAddress: polygonWallet.address,
                      name: maticConfig.tokenName,
                      tokenAddress: maticConfig.tokenAddress,
                      network: maticConfig.network,
                  },
              ]
            : [];
        const baseAssets = baseWallet
            ? [
                  {
                      listItemId: usdcBaseConfig.listItemId,
                      walletAddress: baseWallet.address,
                      name: usdcBaseConfig.tokenName,
                      tokenAddress: usdcBaseConfig.tokenAddress,
                      network: usdcBaseConfig.network,
                  },
                  {
                      listItemId: ethConfig.listItemId,
                      walletAddress: baseWallet.address,
                      name: ethConfig.tokenName,
                      tokenAddress: ethConfig.tokenAddress,
                      network: ethConfig.network,
                  },
              ]
            : [];

        return [...baseAssets, ...polygonAssets];
    }

    public static async getUserWalletAssetsList(phoneNumber: string) {
        const userWallets = await WalletKitService.getUserWallets(phoneNumber);

        return this.computeUserWalletAssetsList(userWallets);
    }

    public static async getUserWalletAssetOrThrow(phoneNumber: string, assetListItemId: string) {
        const assetsList = await this.getUserWalletAssetsList(phoneNumber);

        const asset = assetsList.find((asset) => asset.listItemId === assetListItemId);

        if (!asset) {
            throw new HttpException(BAD_REQUEST, `Asset not found`);
        }

        return asset;
    }

    public static async getUserAssetInfo(phoneNumber: string, assetListItemId: string) {
        const asset = await this.getUserWalletAssetOrThrow(phoneNumber, assetListItemId);

        if (!asset) {
            throw new HttpException(BAD_REQUEST, `Asset not found`);
        }

        const tokenBalance = await WalletKitService.getBalance(
            asset.walletAddress,
            asset.network,
            asset.tokenAddress
        );

        const usdBalance = getDummyUsdValue(asset.name as TokenNames) * parseFloat(tokenBalance);

        return {
            usdDisplayBalance: `$${usdBalance.toFixed(3)}`,
            tokenBalance: tokenBalance,
            walletAddress: asset.walletAddress,
            listItemId: assetListItemId,
            assetName: asset.name,
            assetNetwork: asset.network,
        };
    }

    public static async sendUserAssetForOfframp(asset: UserAssetItem, usdAmount: string) {
        const hotWalletAddress = await FiatRampService.getHotWalletForNetwork('evm');

        const transactionResponse = await WalletKitService.transferToken({
            network: asset.network,
            developer_secret: env.DEVELOPER_SECRET,
            from: asset.walletAddress,
            token: asset.tokenAddress,
            recipient: hotWalletAddress,
            amount: usdAmount,
        });

        return { transactionId: transactionResponse.transaction_id, hotWalletAddress };
    }

    public static async processOfframpTransactionInDemoMode(
        onChainTransactionId: string,
        params: {
            beneficiaryId: string;
            usdAmount: string;
            localAmount: string;
            tokenAddress: string;
            hotWalletAddress: string;
            chainName: string;
            tokenName: string;
            userWalletAddress: string;
        }
    ) {
        const transactionDetails = await WalletKitService.getTransactionById(onChainTransactionId);

        if (transactionDetails.status === 'submitted') {
            setTimeout(() => {
                this.processOfframpTransactionInDemoMode(onChainTransactionId, params);
            }, 10000);
        }

        if (transactionDetails.status === 'success' && transactionDetails.transaction_hash) {
            await FiatRampService.postOfframpTransaction({
                usdAmount: Number(params.usdAmount),
                localAmount: Number(params.localAmount),
                txHash: transactionDetails.transaction_hash,
                beneficiaryId: params.beneficiaryId,
                tokenAddress: params.tokenAddress,
                chainName: params.chainName,
                tokenName: params.tokenName,
                userWalletAddress: params.userWalletAddress,
                hotWalletAddress: params.hotWalletAddress,
            });
        }
    }
}

export default UserService;