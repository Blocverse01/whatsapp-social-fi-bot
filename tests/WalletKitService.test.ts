import WalletKitService from '@/app/WalletKit/WalletKitService';
import { SignAndSendTransactionParams } from '@/app/WalletKit/walletKitSchema';
import { parseEther, toHex } from 'viem';

const TESTNET_DEVELOPER_SECRET = 'testnet-secret';

describe('WalletKitService', () => {
    it('should create wallet successfully', async () => {
        const response = await WalletKitService.createUserWallet({
            network: 'Polygon',
            owner_id: '2348143100808',
            control_mode: 'developer',
            developer_secret: TESTNET_DEVELOPER_SECRET,
            name: 'Polygon Wallet',
            type: 'contract',
        });

        // Assert
        expect(response).toBeDefined();
    });

    it('should get user wallet by network successfully', async () => {
        const response = await WalletKitService.getUserWalletByNetwork('2348143100808', 'Polygon');

        // Assert
        expect(response).toBeDefined();
    });

    it('should get user wallets successfully', async () => {
        const response = await WalletKitService.getUserWallets('2348143100808');

        // Assert
        expect(response.length).toBeGreaterThan(0);
    });

    it('should sign and send transaction successfully', async () => {
        const transactionParams: SignAndSendTransactionParams = {
            network: 'Polygon',
            signer_wallet_address: '0x2C0a6a30fAe9872513609819f667efA7e539021E',
            unsigned_transaction: {
                to: '0xd73594Ddc43B368719a0003BcC1a520c17a16DeB',
                value: toHex(parseEther('0.0006')),
            },
            developer_secret: TESTNET_DEVELOPER_SECRET,
        };

        const response = await WalletKitService.signAndSendTransaction(transactionParams);

        // Assert
        expect(response).toBeDefined();
    });

    it('should get transaction status by id successfully', async () => {
        const response = await WalletKitService.getTransactionById(
            'a15ffcf6-0f01-42c8-a601-d2b351272df1'
        );

        // Assert
        expect(response).toBeDefined();
    });

    it('should transfer token successfully', async () => {
        // TODO: replace params.token with an actual token address
        const response = await WalletKitService.transferToken({
            network: 'Polygon',
            from: '0x2C0a6a30fAe9872513609819f667efA7e539021E',
            token: '0x2C0a6a30fAe9872513609819f667efA7e539021E',
            recipient: '0x2C0a6a30fAe9872513609819f667efA7e539021E',
            amount: '0.01',
            developer_secret: TESTNET_DEVELOPER_SECRET,
        });

        // Assert
        expect(response).toBeDefined();
    });
});
