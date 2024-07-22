import {
    ASSET_ACTION_REGEX_PATTERN,
    AssetInteractiveButtonIds,
    assetInteractiveButtonsIds,
    BaseInteractiveButtonIds,
    ExploreAssetActions,
    InteractiveButtonReplyTypes,
    InteractiveListReplyTypes,
    manageAssetActions,
    MORE_CURRENCIES_COMMAND_REGEX_PATTERN,
    WhatsAppInteractiveButton,
    WhatsAppInteractiveMessage,
    WhatsAppMessageType,
    WhatsAppTextMessage,
} from './WhatsAppBotType';
import axios from 'axios';
import env from '@/constants/env';
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
import {
    SELL_BENEFICIARY_AMOUNT_PATTERN,
    SELL_ASSET_TO_BENEFICIARY_REGEX_PATTERN,
} from '@/constants/regex';
import SumSubService from '@/app/SumSub/SumSubService';
import crypto from 'node:crypto';
import {
    convertBase64ToAsciiString,
    decryptRequest,
    encryptResponse,
} from '@/Resources/utils/encryption';
import WhatsAppBotOffRampFlowService from '@/app/WhatsAppBot/WhatsAppFlows/WhatsAppBotOffRampFlowService';

type PhoneNumberParams = { userPhoneNumber: string; businessPhoneNumberId: string };

class WhatsAppBotService {
    private static WA_BUSINESS_PHONE_NUMBER = env.WA_PHONE_NUMBER_ID;

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
            logServiceError(error, 'Error sending message');
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
                                    description = `Bank Name: ${bankBeneficiaryCast.bankName}\nAccount Number: ${bankBeneficiaryCast.accountNumber}`;
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
                                    id: `${assetAction.action}:${listItemId}`,
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

    public static async beginOfframpFlowMessage(params: {
        businessPhoneNumberId: string;
        recipient: string;
        beneficiaryId: string;
        assetId: string;
    }) {
        const { assetId, beneficiaryId, recipient, businessPhoneNumberId } = params;

        const asset = await UserService.getUserWalletAssetOrThrow(recipient, assetId);

        const flowMessage = WhatsAppBotOffRampFlowService.generateOfframpFlowInitMessage({
            asset,
            beneficiaryId,
            recipient,
        });

        await this.sendWhatsappMessage(businessPhoneNumberId, flowMessage);
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

        if (interactiveListReplyId.match(MORE_CURRENCIES_COMMAND_REGEX_PATTERN)) {
            return 'return-more-currencies';
        }

        if (interactiveListReplyId.match(SELL_ASSET_TO_BENEFICIARY_REGEX_PATTERN)) {
            return 'trigger-offramp-flow';
        }

        throw new Error('Unrecognized action');
    }

    private static async sendKycVerificationUrlMessage(phoneParams: PhoneNumberParams) {
        const { userPhoneNumber, businessPhoneNumberId } = phoneParams;
        const kycUrl = await SumSubService.generateKycUrl(userPhoneNumber);

        const messagePayload: WhatsAppTextMessage = {
            type: WhatsAppMessageType.TEXT,
            text: {
                body: `Please click on the link to verify your identity: ${kycUrl}`,
                preview_url: false,
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await WhatsAppBotService.sendWhatsappMessage(businessPhoneNumberId, messagePayload);
    }

    public static async sendSelectSupportedCurrenciesMessage(
        phoneParams: PhoneNumberParams,
        assetActionId: Extract<ExploreAssetActions, 'buy' | 'sell'>,
        purchaseAssetId: AssetInteractiveButtonIds,
        _sliceFrom = 0,
        _sliceTo = 9
    ) {
        const { userPhoneNumber, businessPhoneNumberId } = phoneParams;

        const supportedCurrencies = await FiatRampService.getSupportedCurrencies();

        // determine sliceFrom considering _sliceFrom and the available indexes of the array
        const sliceFrom = Math.min(_sliceFrom, supportedCurrencies.length - 1);
        // determine sliceTo considering _sliceTo and the available indexes of the array
        const sliceTo = Math.min(_sliceTo, supportedCurrencies.length);

        // determine if there should be a nextSliceFrom
        const nextSliceFrom = sliceTo < supportedCurrencies.length ? sliceTo : null;
        // determine if there should be a nextSliceTo
        const nextSliceTo = nextSliceFrom ? nextSliceFrom + 9 : null;

        const moreListItem =
            nextSliceFrom && nextSliceTo
                ? {
                      id: `moreCurrencies|${assetActionId}:${purchaseAssetId}|nextSliceFrom:${nextSliceFrom}|nextSliceTo:${nextSliceTo}`,
                      title: 'More',
                  }
                : null;

        const countriesToDisplay = supportedCurrencies.slice(sliceFrom, sliceTo);

        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'list',
                body: {
                    text: 'Select your local currency',
                },
                header: {
                    type: 'text',
                    text: 'Choose a Currency',
                },
                action: {
                    button: 'Currencies',
                    sections: [
                        {
                            rows: [
                                ...countriesToDisplay.map((country) => {
                                    return {
                                        id: `${assetActionId}:${purchaseAssetId}|currency:${country.code}`,
                                        title: country.country,
                                        description: `Currency: ${country.currencySymbol}`,
                                    };
                                }),
                                // Add moreListItem only if it's not null
                                ...(moreListItem ? [moreListItem] : []),
                            ],
                        },
                    ],
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await this.sendWhatsappMessage(businessPhoneNumberId, interactiveMessage);
    }

    private static async sendKycInReviewMessage(phoneParams: PhoneNumberParams) {
        const { userPhoneNumber, businessPhoneNumberId } = phoneParams;

        const messagePayload: WhatsAppTextMessage = {
            type: WhatsAppMessageType.TEXT,
            text: {
                body: `Your KYC is currently under review. We'll notify you once it's completed.`,
                preview_url: false,
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await WhatsAppBotService.sendWhatsappMessage(businessPhoneNumberId, messagePayload);
    }

    public static async handleBuyAssetAction(
        phoneParams: PhoneNumberParams,
        assetId: AssetInteractiveButtonIds
    ) {
        const { userPhoneNumber, businessPhoneNumberId } = phoneParams;
        const userKycStatus = await UserService.getUserKycStatus(userPhoneNumber);

        if (
            userKycStatus === 'unverified' ||
            userKycStatus === 'rejected' ||
            userKycStatus === 'pending'
        ) {
            await this.sendKycVerificationUrlMessage(phoneParams);
            return;
        }

        if (userKycStatus === 'in_review') {
            await WhatsAppBotService.sendKycInReviewMessage(phoneParams);
            return;
        }

        await this.sendSelectSupportedCurrenciesMessage(
            phoneParams,
            ExploreAssetActions.BUY_ASSET,
            assetId
        );
    }

    public static async sendKycVerifiedMessage(userPhoneNumber: string) {
        const messagePayload: WhatsAppTextMessage = {
            type: WhatsAppMessageType.TEXT,
            text: {
                body: `Your KYC has been successfully verified🎉\nYou now have access to all functionalities`,
                preview_url: false,
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await WhatsAppBotService.sendWhatsappMessage(this.WA_BUSINESS_PHONE_NUMBER, messagePayload);
    }

    public static async sendKycRejectedMessage(userPhoneNumber: string) {
        const messagePayload: WhatsAppTextMessage = {
            type: WhatsAppMessageType.TEXT,
            text: {
                body: `Your KYC has been rejected. Please re-verify your identity.`,
                preview_url: false,
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await WhatsAppBotService.sendWhatsappMessage(this.WA_BUSINESS_PHONE_NUMBER, messagePayload);
    }

    public static decryptFlowRequest(body: Record<string, string>) {
        const privatePem = convertBase64ToAsciiString(env.WA_FLOW_PRIVATE_KEY);

        return decryptRequest(body, privatePem, env.WA_FLOW_PRIVATE_KEY_SEED_PHRASE);
    }

    public static encryptFlowResponse(
        response: unknown,
        buffers: {
            aesKeyBuffer: Buffer;
            initialVectorBuffer: Buffer;
        }
    ) {
        const { aesKeyBuffer, initialVectorBuffer } = buffers;

        return encryptResponse(response, aesKeyBuffer, initialVectorBuffer);
    }
}

export default WhatsAppBotService;
