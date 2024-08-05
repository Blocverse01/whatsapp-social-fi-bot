import {
    DataExchangeResponse,
    DecryptedFlowDataExchange,
    WhatsAppInteractiveMessage,
} from '@/app/WhatsAppBot/WhatsAppBotType';
import logger from '@/Resources/logger';
import WalletAssetManagementService from '@/app/WalletAssetManagement/WalletAssetManagementService';
import { SIXTEEN, TWO } from '@/constants/numbers';
import { decimalToString, fixNumber } from '@/Resources/utils/currency';
import { AssetConfig } from '@/Resources/web3/tokens';
import { generateRandomHexString } from '@/Resources/utils/encryption';
import { getAssetConfigOrThrow } from '@/config/whatsAppBot';
import UserService from '@/app/User/UserService';
import { TransactionResponse } from '@/app/WalletKit/walletKitSchema';
import { logServiceError } from '@/Resources/requestHelpers/handleRequestError';
import { spawn } from 'child_process';
import path from 'path';
import { UserAssetInfo } from '@/app/User/userSchema';

type FlowMode = Required<WhatsAppInteractiveMessage['interactive']['action']>['parameters']['mode'];

enum TransferToWalletFlowScreens {
    TRANSACTION_DETAILS = 'TRANSACTION_DETAILS',
    TRANSACTION_SUMMARY = 'TRANSACTION_SUMMARY',
    PROCESSING_FEEDBACK = 'PROCESSING_FEEDBACK',
    ERROR_FEEDBACK = 'ERROR_FEEDBACK',
}
type ScreenDataPayload = {
    TRANSACTION_DETAILS: {
        dynamic_page_title: string;
        asset_label: string;
        asset_id: string;
        user_id: string;
        user_balance: string;
    };
    TRANSACTION_SUMMARY: {
        amount: string;
        asset_id: string;
        user_id: string;
        wallet_address: string;
        asset_label: string;
        transaction_fee: string;
    };
    FEEDBACK_SCREEN: {
        message: string;
        status: TransactionResponse['status'];
        asset_id: string;
        is_transfer_transaction: boolean;
    };
};
type DataExchangePayload = {
    TRANSACTION_DETAILS: {
        amount: string;
        asset_id: string;
        user_id: string;
        wallet_address: string;
    };
    TRANSACTION_SUMMARY: {
        amount: string;
        asset_id: string;
        user_id: string;
        wallet_address: string;
        transaction_fee: string;
    };
};

const BACKGROUND_PROCESSES_SCRIPTS_FOLDER = path.join(__dirname, 'backgroundProcesses');

class WhatsAppBotTransferToWalletFlowService {
    private static FLOW_MODE: FlowMode = 'draft';
    private static FLOW_ID = '464881709776668';
    private static INITIAL_SCREEN = TransferToWalletFlowScreens.TRANSACTION_DETAILS;

    public static async receiveDataExchange(
        requestBody: DecryptedFlowDataExchange['decryptedBody']
    ): Promise<DataExchangeResponse> {
        const { action, screen, data } = requestBody;

        if (action === 'INIT') {
            // Using Preview data because initialization should typically be done from `WhatsAppBotService.beginTransferToWalletFlow`
            return this.previewInitializationFlow(requestBody);
        }

        if (action === 'data_exchange') {
            let nextScreenData: Omit<DataExchangeResponse, 'version'> | undefined;

            switch (screen) {
                case TransferToWalletFlowScreens.TRANSACTION_DETAILS:
                    nextScreenData = await this.getTransactionSummaryScreenData(
                        data as DataExchangePayload['TRANSACTION_DETAILS']
                    );
                    break;

                case TransferToWalletFlowScreens.TRANSACTION_SUMMARY:
                    nextScreenData = await this.getFeedbackScreenData(
                        data as DataExchangePayload['TRANSACTION_SUMMARY']
                    );
                    break;
            }

            if (!nextScreenData) {
                throw new Error('Unhandled screen');
            }

            logger.info('Next screen data', nextScreenData);

            return {
                ...nextScreenData,
                version: requestBody.version,
            };
        }

        throw new Error('Unhandled action');
    }

    private static async getTransactionSummaryScreenData(
        data: DataExchangePayload['TRANSACTION_DETAILS']
    ) {
        const asset = getAssetConfigOrThrow(data.asset_id);

        const transactionFee =
            WalletAssetManagementService.calculateStableTokenTransferTransactionFee(
                data.amount,
                asset.network
            );

        return {
            screen: TransferToWalletFlowScreens.TRANSACTION_SUMMARY,
            data: {
                ...data,
                transaction_fee: decimalToString(transactionFee),
                asset_label: `${asset.tokenName} (${asset.network})`,
            } as ScreenDataPayload['TRANSACTION_SUMMARY'],
        };
    }

    private static async getFeedbackScreenData(data: DataExchangePayload['TRANSACTION_SUMMARY']) {
        const walletInfo = await UserService.getUserAssetInfo(data.user_id, data.asset_id);
        const assetBalance = parseFloat(walletInfo.tokenBalance);

        const transactionFee = parseFloat(data.transaction_fee);
        const amount = parseFloat(data.amount);
        const totalAmount = fixNumber(amount + transactionFee, TWO);

        if (assetBalance < totalAmount) {
            const insufficientBalanceMessage = `You're trying to pay: ${totalAmount} ${walletInfo.assetName}\nYou have only: ${assetBalance} ${walletInfo.assetName}`;

            return {
                screen: TransferToWalletFlowScreens.ERROR_FEEDBACK,
                data: {
                    message: insufficientBalanceMessage,
                    status: 'failed',
                    asset_id: data.asset_id,
                    is_transfer_transaction: true,
                } satisfies ScreenDataPayload['FEEDBACK_SCREEN'],
            };
        }

        try {
            const transactionResponse =
                await WalletAssetManagementService.transferUserAssetToWallet(
                    {
                        tokenAddress: walletInfo.tokenAddress,
                        network: walletInfo.assetNetwork,
                        walletAddress: walletInfo.walletAddress,
                        listItemId: walletInfo.listItemId,
                        name: walletInfo.assetName,
                    },
                    data.wallet_address,
                    data.amount
                );

            if (transactionResponse.status === 'failed') {
                return {
                    screen: TransferToWalletFlowScreens.ERROR_FEEDBACK,
                    data: {
                        message: 'Submitting transaction failed, please retry',
                        status: 'failed',
                        asset_id: data.asset_id,
                        is_transfer_transaction: true,
                    } satisfies ScreenDataPayload['FEEDBACK_SCREEN'],
                };
            }

            this.waitForTransactionReceiptInBackground({
                transactionId: transactionResponse.transaction_id,
                userId: data.user_id,
                destination: data.wallet_address,
            });

            return {
                screen: TransferToWalletFlowScreens.PROCESSING_FEEDBACK,
                data: {
                    message: 'Transaction submitted successfully',
                    status: transactionResponse.status,
                    asset_id: data.asset_id,
                    is_transfer_transaction: true,
                } satisfies ScreenDataPayload['FEEDBACK_SCREEN'],
            };
        } catch (error) {
            await logServiceError(
                error,
                'TransferToWalletFlowService.getFeedbackScreenData -> Asset transfer failed'
            );

            return {
                screen: TransferToWalletFlowScreens.ERROR_FEEDBACK,
                data: {
                    message: 'Submitting transaction failed, please retry',
                    status: 'failed',
                    asset_id: data.asset_id,
                    is_transfer_transaction: true,
                } satisfies ScreenDataPayload['FEEDBACK_SCREEN'],
            };
        }
    }

    private static waitForTransactionReceiptInBackground(params: {
        transactionId: string;
        userId: string;
        destination: string;
    }) {
        const transactionParams = JSON.stringify(params);

        // Spawn the background process
        const backgroundProcess = spawn(
            'tsx',
            [
                path.join(BACKGROUND_PROCESSES_SCRIPTS_FOLDER, 'waitForTransactionReceipt.ts'),
                transactionParams,
            ],
            {
                stdio: 'inherit', // Optional: Inherit stdio to see logs in the parent process console
            }
        );

        backgroundProcess.on('error', (err) => {
            logger.error('Failed to start background process:', err);
        });
    }

    public static generateTransferToWalletInitMessage(params: {
        recipient: string;
        asset: UserAssetInfo;
    }) {
        const { asset, recipient } = params;

        const assetLabel = `${asset.assetName} (${asset.assetNetwork})`;

        const transferMessage = `Transfer ${assetLabel}`;

        const flowMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'flow',
                body: {
                    text: transferMessage,
                },
                action: {
                    name: 'flow',
                    parameters: {
                        flow_message_version: '3',
                        flow_token: generateRandomHexString(SIXTEEN),
                        flow_id: this.FLOW_ID,
                        mode: this.FLOW_MODE,
                        flow_cta: 'Transfer Asset',
                        flow_action: 'navigate',
                        flow_action_payload: {
                            screen: this.INITIAL_SCREEN,
                            data: {
                                dynamic_page_title: transferMessage,
                                asset_label: assetLabel,
                                asset_id: asset.listItemId,
                                user_id: recipient,
                                user_balance: `Your balance: ${asset.tokenBalance} ${asset.assetName}`,
                            } satisfies ScreenDataPayload['TRANSACTION_DETAILS'],
                        },
                    },
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };

        return flowMessage;
    }

    public static previewInitializationFlow(
        requestBody: DecryptedFlowDataExchange['decryptedBody']
    ) {
        const data = {
            dynamic_page_title: 'Transfer USDT (Polygon)',
            asset_label: 'USDT (Polygon)',
            asset_id: 'usdt-polygon',
            user_id: '1234567890',
        };

        return {
            screen: TransferToWalletFlowScreens.TRANSACTION_DETAILS,
            data,
            version: requestBody.version,
        };
    }
}

export default WhatsAppBotTransferToWalletFlowService;
