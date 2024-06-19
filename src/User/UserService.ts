import { INTERNAL_SERVER_ERROR } from '@/constants/status-codes';
import { dbClient } from '@/Db/dbClient';
import { HttpException } from '@/Resources/exceptions/HttpException';
import env from '@/constants/env';
import { createRequestOptions } from '@/Resources/HttpRequest';
import axios from 'axios';
import { SUPPORTED_CHAINS } from '@/app/WalletKit/walletKitSchema';
import WalletKitService from '@/app/WalletKit/WalletKitService';

class UserService {
    private USER_TABLE = dbClient.User;

    async createUser(phoneNumber: string, displayName: string) {
        try {
            const user = await this.getUser(phoneNumber);

            if (!user) {
                await this.USER_TABLE.create({
                    phoneNumber: phoneNumber,
                });
            }
        } catch (error) {
            throw new HttpException(INTERNAL_SERVER_ERROR, `User not found`);
        }
    }

    async getUserByMessageId(messageId: string) {
        const record = await this.USER_TABLE.filter({ messageId }).getFirst();
        return record;
    }

    async markMessageProcessed(messageId: string) {
        const record = await this.getUserByMessageId(messageId);
        if (record) {
            await record.update({ messageId: null });
        }
    }

    async getUser(phoneNumber: string) {
        const record = await this.USER_TABLE.filter({ phoneNumber }).getFirst();
        return !!record;
    }

    async createUserWallets(phoneNumber: string) {
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
    }

    async getUserWalletsAction(phoneNumber: string) {
        //const
    }
}

export default new UserService();
