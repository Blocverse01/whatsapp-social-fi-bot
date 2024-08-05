import { DropdownOption, type FlowMode } from '@/app/WhatsAppBot/WhatsAppFlows/types';
import { OnrampTransactionPayload, TransactionStatus } from '@/app/FiatRamp/fiatRampSchema';
import { AssetConfig, TokenNames } from '@/Resources/web3/tokens';
import {
    DataExchangeResponse,
    DecryptedFlowDataExchange,
    WhatsAppInteractiveMessage,
} from '@/app/WhatsAppBot/WhatsAppBotType';
import { generateRandomHexString } from '@/Resources/utils/encryption';
import { SIXTEEN } from '@/constants/numbers';
import logger from '@/Resources/logger';
import { defaultAmountFixer, formatNumberAsCurrency } from '@/Resources/utils/currency';
import { SupportedChain } from '@/app/WalletKit/walletKitSchema';
import { getAssetConfigOrThrow } from '@/config/whatsAppBot';
import FiatRampService from '@/app/FiatRamp/FiatRampService';
import { CountryCode } from 'libphonenumber-js';
import UserService from '@/app/User/UserService';
import { logServiceError } from '@/Resources/requestHelpers/handleRequestError';
import { isAddress } from 'viem';
import WhatsAppBotService from '@/app/WhatsAppBot/WhatsAppBotService';

enum OnRampFlowScreens {
    TRANSACTION_DETAILS = 'TRANSACTION_DETAILS',
    TRANSACTION_SUMMARY = 'TRANSACTION_SUMMARY',
    BANK_PAYMENT = 'BANK_PAYMENT',
    MOMO_PAYMENT = 'MOMO_PAYMENT',
    PROCESSING_FEEDBACK = 'PROCESSING_FEEDBACK',
    ERROR_FEEDBACK = 'ERROR_FEEDBACK',
}

type ScreenPayload = {
    TRANSACTION_DETAILS: {
        dynamic_page_title: string;
        payment_methods: Array<DropdownOption>;
        asset_label: string;
        asset_id: string;
        user_id: string;
        local_currency: string;
        country_code: string;
        init_values: {
            payment_method: string;
        };
    };
    TRANSACTION_SUMMARY: {
        display_data: {
            token_amount: string;
            fiat_to_pay: string;
            payment_method: string;
        };
        transaction_details: {
            channel_id: string;
            token_amount: string;
            transaction_fee: string;
            fiat_to_pay: string;
            external_wallet_address: string;
        };
        buying_to_external_wallet: boolean;
        asset_id: string;
        user_id: string;
        local_currency: string;
        country_code: string;
        account_type: OnrampTransactionPayload['accountType'];
    };
    BANK_PAYMENT: {
        asset_id: string;
        amount: string;
        local_currency: string;
        bank_name: string;
        account_number: string;
        sequence_id: string;
        account_name: string;
        user_id: string;
    };
    MOMO_PAYMENT: {
        asset_id: string;
        amount: string;
        transaction_details: ScreenPayload['TRANSACTION_SUMMARY']['transaction_details'];
        local_currency: string;
        mobile_money_providers: Array<DropdownOption>;
        channel_id: string;
        user_id: string;
        buying_to_external_wallet: boolean;
        country_code: string;
    };
    FEEDBACK_SCREEN: {
        message: string;
        status: TransactionStatus;
        asset_id: string;
        is_on_ramp_transaction: boolean;
    };
};

type DataExchangePayload = {
    TRANSACTION_DETAILS: {
        payment_method: string;
        payment_methods: Array<DropdownOption>;
        asset_id: string;
        wallet_address?: string;
        amount: string;
        user_id: string;
        local_currency: string;
        country_code: string;
    };
    TRANSACTION_SUMMARY: {
        asset_id: string;
        user_id: string;
        buying_to_external_wallet: boolean;
        transaction_details: ScreenPayload['TRANSACTION_SUMMARY']['transaction_details'];
        local_currency: string;
        country_code: string;
        account_type: OnrampTransactionPayload['accountType'];
    };
    BANK_PAYMENT: {
        asset_id: string;
        account_number: string;
        amount: string;
        bank_name: string;
        sequence_id: string;
        account_name: string;
        user_id: string;
    };
    MOMO_PAYMENT: {
        asset_id: string;
        mobile_number: string;
        mobile_provider: string;
        first_name: string;
        last_name: string;
        channel_id: string;
        mobile_providers: Array<DropdownOption>;
        user_id: string;
        country_code: string;
        buying_to_external_wallet: boolean;
        local_currency: string;
        transaction_details: ScreenPayload['TRANSACTION_SUMMARY']['transaction_details'];
    };
};

type TokenAmountPattern =
    `${number} ${TokenNames} (${SupportedChain})\n---------------------------------\nFee = ${number} ${TokenNames}`;

type FiatToPayPattern = `${string}\n---------------------------------\n1 ${TokenNames} = ${string}`;

const SECTION_SEPARATOR = '\n---------------------------------\n' as const;

class WhatsAppBotOnRampFlowService {
    private static readonly FLOW_MODE: FlowMode = 'draft';
    private static readonly FLOW_ID = '457607423727887';
    private static readonly INITIAL_SCREEN = OnRampFlowScreens.TRANSACTION_DETAILS;

    public static async receiveDataExchange(
        requestBody: DecryptedFlowDataExchange['decryptedBody']
    ): Promise<DataExchangeResponse> {
        const { action, screen, data } = requestBody;

        if (action === 'INIT') {
            // Using Preview data because initialization should typically be done from `WhatsAppBotService.beginOnRampFlowMessage`
            return this.previewInitializationFlow(requestBody);
        }

        if (action === 'data_exchange') {
            let nextScreenData: Omit<DataExchangeResponse, 'version'> | undefined;

            switch (screen) {
                case OnRampFlowScreens.TRANSACTION_DETAILS:
                    nextScreenData = await this.getTransactionSummaryScreenData(
                        data as DataExchangePayload['TRANSACTION_DETAILS']
                    );
                    break;
                case OnRampFlowScreens.TRANSACTION_SUMMARY:
                    nextScreenData = await this.getPaymentScreenData(
                        data as DataExchangePayload['TRANSACTION_SUMMARY']
                    );
                    break;
                case OnRampFlowScreens.BANK_PAYMENT:
                    nextScreenData = await this.getBankPaymentFeedbackScreenData(
                        data as DataExchangePayload['BANK_PAYMENT']
                    );
                    break;
                case OnRampFlowScreens.MOMO_PAYMENT:
                    nextScreenData = await this.getMomoPaymentFeedbackScreenData(
                        data as DataExchangePayload['MOMO_PAYMENT']
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

    private static generateFiatToPayPattern(
        rate: number,
        currency: string,
        asset: AssetConfig,
        fiatAmount: number
    ) {
        return `${formatNumberAsCurrency(fiatAmount, currency)}${SECTION_SEPARATOR}1 ${asset.tokenName} = ${formatNumberAsCurrency(rate, currency)}` satisfies FiatToPayPattern;
    }

    private static generateTokenAmountPattern(
        amount: number,
        asset: AssetConfig,
        transactionFee: number
    ) {
        const tokenAmount: TokenAmountPattern = `${amount} ${asset.tokenName} (${asset.network})${SECTION_SEPARATOR}Fee = ${transactionFee} ${asset.tokenName}`;

        return tokenAmount;
    }

    private static determineSelectedPaymentMethod(
        payment_method: string,
        payment_methods: Array<DropdownOption>
    ) {
        const selectedPaymentMethod = payment_methods.find((type) => type.id === payment_method);

        if (!selectedPaymentMethod) {
            throw new Error('Invalid payment method');
        }

        return {
            paymentMethodTitle: selectedPaymentMethod.title,
            accountType: selectedPaymentMethod.title.toLowerCase().includes('bank')
                ? 'bank'
                : 'phone',
            channelId: selectedPaymentMethod.id,
        };
    }

    private static async getTransactionSummaryScreenData(
        input: DataExchangePayload['TRANSACTION_DETAILS']
    ) {
        const {
            amount,
            asset_id,
            payment_methods,
            payment_method,
            local_currency,
            user_id,
            wallet_address,
            country_code,
        } = input;

        const assetConfig = getAssetConfigOrThrow(asset_id);

        const { rate: conversionRate, fee } = await FiatRampService.getQuotes(
            local_currency,
            country_code as CountryCode,
            'offramp'
        );

        const amountAsNumber = parseFloat(amount.trim());
        const transactionFee = defaultAmountFixer(amountAsNumber * fee);
        const totalAmount = defaultAmountFixer(amountAsNumber + transactionFee);
        const fiatEquivalent = defaultAmountFixer(totalAmount * conversionRate);

        const token_amount: TokenAmountPattern = this.generateTokenAmountPattern(
            amountAsNumber,
            assetConfig,
            transactionFee
        );
        const fiat_to_pay: FiatToPayPattern = this.generateFiatToPayPattern(
            conversionRate,
            local_currency,
            assetConfig,
            fiatEquivalent
        );

        const selectedPaymentMethod = this.determineSelectedPaymentMethod(
            payment_method,
            payment_methods
        );

        return {
            screen: OnRampFlowScreens.TRANSACTION_SUMMARY,
            data: {
                display_data: {
                    token_amount,
                    fiat_to_pay,
                    payment_method: selectedPaymentMethod.paymentMethodTitle,
                },
                transaction_details: {
                    channel_id: selectedPaymentMethod.channelId,
                    token_amount: amount,
                    transaction_fee: transactionFee.toString(),
                    fiat_to_pay: fiatEquivalent.toString(),
                    external_wallet_address: wallet_address || '',
                },
                buying_to_external_wallet: !!wallet_address,
                asset_id,
                local_currency,
                user_id,
                country_code,
                account_type:
                    selectedPaymentMethod.accountType as OnrampTransactionPayload['accountType'],
            } satisfies ScreenPayload['TRANSACTION_SUMMARY'],
        };
    }

    private static async getPaymentScreenData(input: DataExchangePayload['TRANSACTION_SUMMARY']) {
        const {
            asset_id,
            transaction_details,
            buying_to_external_wallet,
            local_currency,
            user_id,
            account_type,
            country_code,
        } = input;

        try {
            const assetWallet = await UserService.getUserWalletAssetOrThrow(user_id, asset_id);

            if (account_type === 'phone') {
                const mobileProviders = await FiatRampService.getSupportedMobileProviders(
                    transaction_details.channel_id
                );

                return {
                    screen: OnRampFlowScreens.MOMO_PAYMENT,
                    data: {
                        asset_id,
                        amount: formatNumberAsCurrency(
                            parseFloat(transaction_details.token_amount),
                            local_currency
                        ),
                        local_currency,
                        mobile_money_providers: mobileProviders.map((provider) => ({
                            title: provider.name,
                            id: provider.networkId,
                        })),
                        channel_id: transaction_details.channel_id,
                        user_id,
                        transaction_details: transaction_details,
                        buying_to_external_wallet,
                        country_code,
                    } satisfies ScreenPayload['MOMO_PAYMENT'],
                };
            }

            if (account_type === 'bank') {
                if (buying_to_external_wallet) {
                    if (!transaction_details.external_wallet_address) {
                        return {
                            screen: OnRampFlowScreens.ERROR_FEEDBACK,
                            data: {
                                message: 'External wallet address is required',
                                status: 'failed',
                                asset_id,
                                is_on_ramp_transaction: true,
                            } satisfies ScreenPayload['FEEDBACK_SCREEN'],
                        };
                    }

                    if (!isAddress(transaction_details.external_wallet_address)) {
                        return {
                            screen: OnRampFlowScreens.ERROR_FEEDBACK,
                            data: {
                                message: 'Invalid external wallet address',
                                status: 'failed',
                                asset_id,
                                is_on_ramp_transaction: true,
                            } satisfies ScreenPayload['FEEDBACK_SCREEN'],
                        };
                    }
                }

                const verifiedUserDetails = await UserService.getUserIdentityInfo(user_id);

                if (!verifiedUserDetails) {
                    return {
                        screen: OnRampFlowScreens.ERROR_FEEDBACK,
                        data: {
                            message: 'You need to verify your identity to proceed',
                            status: 'failed',
                            asset_id,
                            is_on_ramp_transaction: true,
                        } satisfies ScreenPayload['FEEDBACK_SCREEN'],
                    };
                }

                const onrampResponse = await FiatRampService.postOnRampTransaction({
                    accountType: account_type,
                    userWalletAddress: buying_to_external_wallet
                        ? transaction_details.external_wallet_address
                        : assetWallet.walletAddress,
                    localAmount: parseFloat(transaction_details.fiat_to_pay),
                    tokenName: assetWallet.name,
                    chainName: assetWallet.network.toUpperCase(),
                    channelId: transaction_details.channel_id,
                    country: country_code,
                    userDetails: verifiedUserDetails,
                });

                if (onrampResponse.bankInfo === undefined) {
                    return {
                        screen: OnRampFlowScreens.ERROR_FEEDBACK,
                        data: {
                            message: 'Failed to retrieve payment details',
                            status: 'failed',
                            asset_id,
                            is_on_ramp_transaction: true,
                        } satisfies ScreenPayload['FEEDBACK_SCREEN'],
                    };
                }

                // TODO: make message more readable, and remove duplicated formatting
                const message = `Your transaction with the following details:\n\n💲 Buy ${transaction_details.token_amount} ${assetWallet.name} on ${assetWallet.network} for ${formatNumberAsCurrency(parseFloat(transaction_details.fiat_to_pay), local_currency)} has been initiated\n\nPlease make payment to complete the transaction.\n\nHere's the payment details in case you missed it:\n\nAccount Number: ${onrampResponse.bankInfo.accountNumber}\n\nAccount Name: ${onrampResponse.bankInfo.accountName}\n\nBank Name: ${onrampResponse.bankInfo.bankName}\n\nAmount: ${formatNumberAsCurrency(parseFloat(transaction_details.fiat_to_pay), local_currency)}\n\nAfter you have made payment, we'd send you status updates on the transaction.`;

                WhatsAppBotService.sendArbitraryTextMessage(user_id, message).then(() => {
                    logger.info('WhatsApp message sent');
                });

                return {
                    screen: OnRampFlowScreens.BANK_PAYMENT,
                    data: {
                        account_number: onrampResponse.bankInfo.accountNumber,
                        bank_name: onrampResponse.bankInfo.bankName,
                        account_name: onrampResponse.bankInfo.accountName,
                        asset_id,
                        amount: formatNumberAsCurrency(
                            parseFloat(onrampResponse.amount),
                            local_currency
                        ),
                        local_currency,
                        sequence_id: onrampResponse.sequenceId,
                        user_id,
                    } satisfies ScreenPayload['BANK_PAYMENT'],
                };
            }
        } catch (error) {
            await logServiceError(error, 'An error occurred while processing on-ramp transaction');

            return {
                screen: OnRampFlowScreens.ERROR_FEEDBACK,
                data: {
                    message: 'An unexpected error occurred',
                    status: 'failed',
                    asset_id,
                    is_on_ramp_transaction: true,
                } satisfies ScreenPayload['FEEDBACK_SCREEN'],
            };
        }
    }

    private static async getBankPaymentFeedbackScreenData(
        input: DataExchangePayload['BANK_PAYMENT']
    ) {
        const { asset_id, sequence_id } = input;

        try {
            const transactionStatus = await FiatRampService.getTransactionStatus(
                sequence_id,
                'onramp'
            );

            if (transactionStatus === 'failed') {
                return {
                    screen: OnRampFlowScreens.ERROR_FEEDBACK,
                    data: {
                        message:
                            'Transaction failed, If you were debited, expect a refund within 24 hours',
                        status: 'failed',
                        asset_id,
                        is_on_ramp_transaction: true,
                    } satisfies ScreenPayload['FEEDBACK_SCREEN'],
                };
            }

            return {
                screen: OnRampFlowScreens.PROCESSING_FEEDBACK,
                data: {
                    message:
                        'Your transaction is being processed, we will notify you once the transaction is complete',
                    status: 'processing',
                    asset_id,
                    is_on_ramp_transaction: true,
                } satisfies ScreenPayload['FEEDBACK_SCREEN'],
            };
        } catch (error) {
            await logServiceError(
                error,
                'An error occurred while processing bank onramp transaction'
            );

            return {
                screen: OnRampFlowScreens.ERROR_FEEDBACK,
                data: {
                    message: 'An unexpected error occurred',
                    status: 'failed',
                    asset_id,
                    is_on_ramp_transaction: true,
                } satisfies ScreenPayload['FEEDBACK_SCREEN'],
            };
        }
    }

    private static async getMomoPaymentFeedbackScreenData(
        input: DataExchangePayload['MOMO_PAYMENT']
    ) {
        const {
            asset_id,
            channel_id,
            mobile_number,
            mobile_provider,
            user_id,
            country_code,
            transaction_details,
            buying_to_external_wallet,
            local_currency,
        } = input;

        if (buying_to_external_wallet) {
            if (!transaction_details.external_wallet_address) {
                return {
                    screen: OnRampFlowScreens.ERROR_FEEDBACK,
                    data: {
                        message: 'External wallet address is required',
                        status: 'failed',
                        asset_id,
                        is_on_ramp_transaction: true,
                    } satisfies ScreenPayload['FEEDBACK_SCREEN'],
                };
            }

            if (!isAddress(transaction_details.external_wallet_address)) {
                return {
                    screen: OnRampFlowScreens.ERROR_FEEDBACK,
                    data: {
                        message: 'Invalid external wallet address',
                        status: 'failed',
                        asset_id,
                        is_on_ramp_transaction: true,
                    } satisfies ScreenPayload['FEEDBACK_SCREEN'],
                };
            }
        }

        try {
            const assetWallet = await UserService.getUserWalletAssetOrThrow(user_id, asset_id);

            const verifiedUserDetails = await UserService.getUserIdentityInfo(user_id);

            if (!verifiedUserDetails) {
                return {
                    screen: OnRampFlowScreens.ERROR_FEEDBACK,
                    data: {
                        message: 'You need to verify your identity to proceed',
                        status: 'failed',
                        asset_id,
                        is_on_ramp_transaction: true,
                    } satisfies ScreenPayload['FEEDBACK_SCREEN'],
                };
            }

            await FiatRampService.postOnRampTransaction({
                channelId: channel_id,
                accountNumber: mobile_number,
                accountType: 'phone',
                country: country_code,
                networkId: mobile_provider,
                userDetails: verifiedUserDetails,
                userWalletAddress: buying_to_external_wallet
                    ? transaction_details.external_wallet_address
                    : assetWallet.walletAddress,
                localAmount: parseFloat(transaction_details.fiat_to_pay),
                chainName: assetWallet.network.toUpperCase(),
                tokenName: assetWallet.name,
            });

            const message = `Your transaction with the following details:\n\n💲 Buy ${transaction_details.token_amount} ${assetWallet.name} on ${assetWallet.network} for ${formatNumberAsCurrency(parseFloat(transaction_details.fiat_to_pay), local_currency)} has been initiated\n\nPlease follow the instructions on your phone to complete the transaction`;

            await WhatsAppBotService.sendArbitraryTextMessage(user_id, message);

            return {
                screen: OnRampFlowScreens.PROCESSING_FEEDBACK,
                data: {
                    message:
                        'Follow the instructions on your phone to complete the transaction, we will notify you once the transaction is complete',
                    status: 'pending',
                    asset_id,
                    is_on_ramp_transaction: true,
                } satisfies ScreenPayload['FEEDBACK_SCREEN'],
            };
        } catch (error) {
            await logServiceError(
                error,
                'An error occurred while processing mobile money onramp transaction'
            );

            return {
                screen: OnRampFlowScreens.ERROR_FEEDBACK,
                data: {
                    message: 'An unexpected error occurred',
                    status: 'failed',
                    asset_id,
                    is_on_ramp_transaction: true,
                } satisfies ScreenPayload['FEEDBACK_SCREEN'],
            };
        }
    }

    public static generateOnRampFlowInitMessage(params: {
        asset: AssetConfig;
        localCurrency: string;
        countryCode: string;
        recipient: string;
        paymentMethods: Array<DropdownOption>;
    }) {
        const { asset, localCurrency, recipient, paymentMethods, countryCode } = params;

        const assetLabel = `${asset.tokenName} (${asset.network})`;
        const buyMessage = `Buy ${assetLabel} with ${localCurrency}`;

        const flowMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'flow',
                body: {
                    text: buyMessage,
                },
                action: {
                    name: 'flow',
                    parameters: {
                        flow_message_version: '3',
                        flow_token: generateRandomHexString(SIXTEEN),
                        flow_id: this.FLOW_ID,
                        mode: this.FLOW_MODE,
                        flow_cta: 'Buy Asset',
                        flow_action: 'navigate',
                        flow_action_payload: {
                            screen: this.INITIAL_SCREEN,
                            data: {
                                dynamic_page_title: buyMessage,
                                asset_label: assetLabel,
                                asset_id: asset.listItemId,
                                user_id: recipient,
                                local_currency: localCurrency,
                                payment_methods: paymentMethods,
                                country_code: countryCode,
                                init_values: {
                                    payment_method: paymentMethods[0].id,
                                },
                            } satisfies ScreenPayload['TRANSACTION_DETAILS'],
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
            dynamic_page_title: 'Buy USDT (Polygon) with NGN',
            asset_label: 'USDT (Polygon)',
            asset_id: 'usdt-polygon',
            user_id: '1234567890',
            local_currency: 'NGN',
            payment_methods: [
                {
                    title: 'Bank Transfer',
                    id: 'bank_transfer',
                },
                {
                    title: 'Mobile Money',
                    id: 'mobile_money',
                },
            ],
            country_code: 'NG',
            init_values: {
                payment_method: 'bank_transfer',
            },
        } satisfies ScreenPayload['TRANSACTION_DETAILS'];

        return {
            screen: OnRampFlowScreens.TRANSACTION_DETAILS,
            data,
            version: requestBody.version,
        };
    }
}

export default WhatsAppBotOnRampFlowService;
