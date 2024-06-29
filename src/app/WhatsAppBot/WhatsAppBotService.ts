import {
    ASSET_ACTION_REGEX_PATTERN,
    AssetInteractiveButtonIds,
    assetInteractiveButtonsIds,
    BaseInteractiveButtonIds,
    ExploreAssetActions,
    InteractiveButtonReplyTypes,
    InteractiveListReplyTypes,
    manageAssetActions,
    WhatsAppInteractiveButton,
    WhatsAppInteractiveMessage,
    WhatsAppMessageType,
    WhatsAppTextMessage,
} from './WhatsAppBotType';
import axios, { isAxiosError } from 'axios';
import env from '@/constants/env';
import { INTERNAL_SERVER_ERROR } from '@/constants/status-codes';
import { HttpException } from '@/Resources/exceptions/HttpException';
import UserService from '@/app/User/UserService';
import logger from '@/Resources/logger';
import { UserAssetItem } from '@/app/User/userSchema';
import {
    BankBeneficiary,
    MobileMoneyBeneficiary,
    UsersBeneficiaries,
} from '@/app/FiatRamp/fiatRampSchema';
import { logServiceError } from '@/Resources/requestHelpers/handleRequestError';
import FiatRampService from '@/app/FiatRamp/FiatRampService';
import { TokenNames } from '@/Resources/web3/tokens';
import { SELL_BENEFICIARY_AMOUNT_PATTERN } from '@/constants/regex';

class WhatsAppBotService {
    private static getRequestConfig() {
        return {
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                Authorization: `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
            },
        };
    }

    public static async sendWhatsappMessage(businessPhoneNumberId: string, data: object) {
        const endpoint = `${businessPhoneNumberId}/messages`;

        try {
            const requestOptions = this.getRequestConfig();
            const response = await axios.post(
                `${env.CLOUD_API_URL}/${endpoint}`,
                data,
                requestOptions
            );

            logger.info('Message sent successfully');
        } catch (error) {
            let message = 'Failed to send message';

            if (isAxiosError(error)) {
                logger.error('Error sending message', { errorResponse: error.response });
                message = error.response?.data?.message;
            }

            throw new HttpException(INTERNAL_SERVER_ERROR, message);
        }
    }

    public static async listWalletAddressMessage(
        businessPhoneNumberId: string,
        displayName: string,
        recipient: string,
        walletAssets: Array<UserAssetItem>,
        accountType: string
    ) {
        const text =
            accountType === 'new_account'
                ? `Congrats ${displayName}, welcome aboard 🎉\n\nWe've created decentralized wallets for you. It's like opening a digital piggy bank! 🐷💰.\n\nClick on an asset to display the wallet address and balance`
                : `Click on an asset to display the wallet address and balance`;

        const walletAssetsButton: WhatsAppInteractiveButton[] = walletAssets
            .map((asset) => ({
                type: 'reply' as const,
                reply: {
                    id: asset.listItemId,
                    title: `${asset.name} (${asset.network.toUpperCase()})`,
                },
            }))
            .slice(0, 2);

        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: text,
                },
                action: {
                    buttons: walletAssetsButton,
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };
        await this.sendWhatsappMessage(businessPhoneNumberId, interactiveMessage);
    }

    public static async listBeneficiaryMessage(
        businessPhoneNumberId: string,
        recipient: string,
        usersBeneficiaries: UsersBeneficiaries,
        assetId: string
    ) {
        const interactiveMessageList = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'interactive',
            interactive: {
                type: 'list',
                body: {
                    text: 'Select a beneficiary by clicking the button below.',
                },
                header: {
                    type: 'text',
                    text: 'Choose a Beneficiary',
                },
                action: {
                    button: 'Beneficiaries',
                    sections: [
                        {
                            rows: usersBeneficiaries.map((beneficiary) => {
                                let title: string;
                                let description: string;

                                if ((beneficiary as MobileMoneyBeneficiary).firstName) {
                                    const mobileMoneyBeneficiaryCast =
                                        beneficiary as MobileMoneyBeneficiary;
                                    title = `${mobileMoneyBeneficiaryCast.firstName} ${mobileMoneyBeneficiaryCast.lastName}`;
                                    description = `Mobile Number: ${mobileMoneyBeneficiaryCast.firstName}`;
                                } else {
                                    const bankBeneficiaryCast = beneficiary as BankBeneficiary;
                                    title = `${bankBeneficiaryCast.accountName}`;
                                    description = `Bank Name: ${bankBeneficiaryCast.bankName} \nAccount Number: ${bankBeneficiaryCast.accountNumber}`;
                                }
                                return {
                                    id: `${assetId}|beneficiaryId:${beneficiary.id}`,
                                    title: title,
                                    description: description,
                                };
                            }),
                        },
                    ],
                },
            },
        };

        await this.sendWhatsappMessage(businessPhoneNumberId, interactiveMessageList);
    }

    public static async walletDetailsMessage(
        businessPhoneNumberId: string,
        recipient: string,
        userAssetInfo: {
            usdDisplayBalance: string;
            tokenBalance: string;
            walletAddress: string;
            listItemId: string;
            assetName: string;
            assetNetwork: string;
        }
    ) {
        const {
            usdDisplayBalance,
            walletAddress,
            listItemId,
            tokenBalance,
            assetName,
            assetNetwork,
        } = userAssetInfo;
        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: WhatsAppMessageType.INTERACTIVE,
            interactive: {
                type: 'list',
                body: {
                    text: `Asset Balance 💰: ${tokenBalance} \n\nAsset Balance(USD) 💰: ${usdDisplayBalance} \n\nWallet Address: ${walletAddress}`,
                },
                header: {
                    type: 'text',
                    text: `${assetName} (${assetNetwork.toUpperCase()})`,
                },
                action: {
                    button: 'Manage Asset',
                    sections: [
                        {
                            rows: manageAssetActions.map((assetAction) => {
                                return {
                                    id: `action:${assetAction.action}|assetId:${listItemId}`,
                                    title: assetAction.text,
                                    description: assetAction.description,
                                };
                            }),
                        },
                    ],
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };

        await this.sendWhatsappMessage(businessPhoneNumberId, interactiveMessage);
    }

    public static async createWalletMessage(
        businessPhoneNumberId: string,
        displayName: string,
        recipient: string
    ) {
        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: `Hi ${displayName}! Ready to get started? Let us create a wallet for you.`,
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: BaseInteractiveButtonIds.CREATE_WALLET,
                                title: "Let's go 🚀",
                            },
                        },
                    ],
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };
        await this.sendWhatsappMessage(businessPhoneNumberId, interactiveMessage);
    }

    public static async markMassageAsRead(businessPhoneNumberId: string, messageId: string) {
        const endpoint = `${businessPhoneNumberId}/messages`;
        const data = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
        };

        try {
            const requestOptions = this.getRequestConfig();
            const response = await axios.post(
                `${env.CLOUD_API_URL}/${endpoint}`,
                data,
                requestOptions
            );
            console.log('Message marked as read successfully:', response.data); // Handle successful response (optional)
        } catch (error) {
            logServiceError(error, 'Error marking message as read:');
        }
    }

    public static async selectAmountMessage(
        businessPhoneNumberId: string,
        recipient: string,
        beneficiaryId: string
    ) {
        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: `How much would you like to withdraw?`,
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: `${beneficiaryId}|amount:2`,
                                title: '$2',
                            },
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: `${beneficiaryId}|amount:5`,
                                title: '$5',
                            },
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: `${beneficiaryId}|amount:10`,
                                title: '$10',
                            },
                        },
                    ],
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };
        await this.sendWhatsappMessage(businessPhoneNumberId, interactiveMessage);
    }

    public static async isMessageProcessed(messageId: string) {
        try {
            const data = await UserService.getUserByMessageId(messageId);
            return !!data;
        } catch (error) {
            logServiceError(error, 'Error checking processed messages:');
        }
    }

    // Function to mark message as processed
    public static async markMessageProcessed(messageId: string): Promise<void> {
        try {
            const data = await UserService.markMessageProcessed(messageId);
        } catch (error) {
            logServiceError(error, 'Error marking message as processed:');
        }
    }

    public static async ratesCommandHandler(
        userPhoneNumber: string,
        businessPhoneNumberId: string
    ) {
        const rates = await FiatRampService.getAllRates();

        const messagePayload: WhatsAppTextMessage = {
            type: WhatsAppMessageType.TEXT,
            text: {
                body: `Conversion Rates\n\n${rates.map((rate) => `==================\n${rate.code}/USDC\nBuy: ${rate.buy}\nSell: ${rate.sell}`).join('\n\n')}`,
                preview_url: false,
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await WhatsAppBotService.sendWhatsappMessage(businessPhoneNumberId, messagePayload);
    }

    public static async depositAssetCommandHandler(
        userPhoneNumber: string,
        businessPhoneNumberId: string,
        listItemId: string
    ) {
        const asset = await UserService.getUserWalletAssetOrThrow(userPhoneNumber, listItemId);

        const messagePayload: WhatsAppTextMessage = {
            type: WhatsAppMessageType.TEXT,
            text: {
                body: `${asset.walletAddress}`,
                preview_url: false,
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await WhatsAppBotService.sendWhatsappMessage(businessPhoneNumberId, messagePayload);
    }

    public static async processTransactionInDemoMode(
        userPhoneNumber: string,
        businessPhoneNumberId: string,
        params: { assetId: string; beneficiaryId: string; usdAmount: string }
    ) {
        const asset = await UserService.getUserWalletAssetOrThrow(userPhoneNumber, params.assetId);

        // Can only offramp USDC in demo mode
        if (asset.name !== TokenNames.USDC) {
            return;
        }

        const quote = await FiatRampService.getQuotes('NGN', 'NG', 'offramp');

        const numericUsdAmount = parseFloat(params.usdAmount);
        const fiatAmountToReceive = (quote.rate * numericUsdAmount).toFixed(2);

        const cryptoAmountToDebit = (numericUsdAmount + numericUsdAmount * quote.fee).toFixed(2);

        const { transactionId, hotWalletAddress } = await UserService.sendUserAssetForOfframp(
            asset,
            cryptoAmountToDebit
        );

        const messagePayload: WhatsAppTextMessage = {
            type: WhatsAppMessageType.TEXT,
            text: {
                body: `🚀Processing Bank Account Withdrawal\n\nAsset:${asset.name}\nAmount: ${cryptoAmountToDebit} USDC\nEquivalent: ${fiatAmountToReceive} NGN\nTransaction ID: ${transactionId}`,
                preview_url: false,
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await WhatsAppBotService.sendWhatsappMessage(businessPhoneNumberId, messagePayload);

        await UserService.processOfframpTransactionInDemoMode(transactionId, {
            beneficiaryId: params.beneficiaryId,
            usdAmount: cryptoAmountToDebit,
            localAmount: fiatAmountToReceive,
            tokenAddress: asset.tokenAddress,
            hotWalletAddress: hotWalletAddress,
            chainName: asset.network.toUpperCase(),
            tokenName: 'USDC',
            userWalletAddress: asset.walletAddress,
        });
    }

    public static determineInteractiveButtonReplyAction(
        interactiveButtonId: string
    ): InteractiveButtonReplyTypes {
        if (interactiveButtonId === BaseInteractiveButtonIds.CREATE_WALLET) {
            return 'create-wallet';
        }

        if (assetInteractiveButtonsIds.includes(interactiveButtonId as AssetInteractiveButtonIds)) {
            return 'explore-asset';
        }

        if (interactiveButtonId.match(SELL_BENEFICIARY_AMOUNT_PATTERN)) {
            return 'demo-withdraw-amount-to-beneficiary';
        }

        throw new Error('Unrecognized action');
    }

    public static determineInteractiveListReplyAction(
        interactiveListReplyId: string
    ): InteractiveListReplyTypes {
        if (interactiveListReplyId.match(ASSET_ACTION_REGEX_PATTERN)) {
            return 'explore-asset-action';
        }

        throw new Error('Unrecognized action');
    }
}

export default WhatsAppBotService;
