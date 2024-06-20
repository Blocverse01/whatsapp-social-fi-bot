import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from '@/constants/status-codes';
import { dbClient } from '@/Db/dbClient';
import { HttpException } from '@/Resources/exceptions/HttpException';
import env from '@/constants/env';
import { createRequestOptions } from '@/Resources/HttpRequest';
import axios from 'axios';
import { CreateWalletKitWalletResponse, SUPPORTED_CHAINS } from '@/app/WalletKit/walletKitSchema';
import WalletKitService from '@/app/WalletKit/WalletKitService';
import { UserAssetItem } from '@/User/userSchema';
import { ethConfig, maticConfig, usdcBaseConfig, usdtPolygonConfig } from '@/Resources/web3/tokens';
import { Users } from 'walletkit-js/api/resources/users/client/Client';

class UserService {
    private static USER_TABLE = dbClient.User;

    public static async createUser(phoneNumber: string, displayName: string) {
        try {
            const user = await this.getUser(phoneNumber);

            if (!user) {
                await this.USER_TABLE.create({
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
                  },
                  {
                      listItemId: maticConfig.listItemId,
                      walletAddress: polygonWallet.address,
                      name: maticConfig.tokenName,
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
                  },
                  {
                      listItemId: ethConfig.listItemId,
                      walletAddress: baseWallet.address,
                      name: ethConfig.tokenName,
                  },
              ]
            : [];

        return [...baseAssets, ...polygonAssets];
    }

    public static async getUserWalletAssetsList(phoneNumber: string) {
        const userWallets = await WalletKitService.getUserWallets(phoneNumber);

        return this.computeUserWalletAssetsList(userWallets);
    }

    public static async getUserAssetInfo(listWalletId: string) {
        const assetsList = await this.getUserWalletAssetsList(listWalletId);

        const asset = assetsList.find((asset) => asset.listItemId === listWalletId);

        if (!asset) {
            throw new HttpException(BAD_REQUEST, `Asset not found`);
        }
    }
}

export default UserService;
