import {
    DataExchangeResponse,
    DecryptedFlowDataExchange,
    WhatsAppInteractiveMessage,
} from '@/app/WhatsAppBot/WhatsAppBotType';
import crypto from 'node:crypto';
import { AssetConfig, getAssetConfigOrThrow, TokenNames } from '@/Resources/web3/tokens';
import { SupportedChain } from '@/app/WalletKit/walletKitSchema';
import FiatRampService from '@/app/FiatRamp/FiatRampService';
import {
    BankBeneficiary,
    MobileMoneyBeneficiary,
    SendOfframpRequestPayload,
} from '@/app/FiatRamp/fiatRampSchema';
import { defaultAmountFixer, formatNumberAsCurrency } from '@/Resources/utils/currency';
import UserService from '@/app/User/UserService';
import { CountryCode } from 'libphonenumber-js';
import { logServiceError } from '@/Resources/requestHelpers/handleRequestError';
import WalletKitService from '@/app/WalletKit/WalletKitService';
import logger from '@/Resources/logger';

type FlowMode = Required<WhatsAppInteractiveMessage['interactive']['action']>['parameters']['mode'];

enum OffRampFlowScreens {
    AMOUNT_INPUT = 'AMOUNT_INPUT',
    TRANSACTION_SUMMARY = 'TRANSACTION_SUMMARY',
    PROCESSING_FEEDBACK = 'PROCESSING_FEEDBACK',
    ERROR_FEEDBACK = 'ERROR_FEEDBACK',
}

type DataExchangedFromAmountInputScreen = {
    amount: string;
    asset_id: string;
    user_id: string;
    beneficiary: {
        id: string;
        account_name: string;
        account_number: string;
        provider_name: string;
        currency_symbol: string;
        country_code: string;
    };
    asset_label: string;
};
type DataExchangedFromTransactionSummaryScreen = {
    asset_id: string;
    token_amount_to_debit: string;
    token_amount: string;
    user_id: string;
    fiat_to_receive: string;
    beneficiary_id: string;
    transaction_fee: string;
};

type TokenAmountPattern =
    `${number} ${TokenNames} (${SupportedChain})\n---------------------------------\nFee = ${number} ${TokenNames}`;
type TokenAmountToDebitPattern = `${number} ${TokenNames}`;
type DestinationPattern = `${string} | ${string} | ${string}`;
type FiatToReceivePattern =
    `${string}\n---------------------------------\n1 ${TokenNames} = ${string}`;

const SECTION_SEPARATOR = '\n---------------------------------\n' as const;

type ProcessOfframpTransactionResponse = {
    status: 'processing' | 'complete' | 'failed' | 'pending';
    message: string;
};

class WhatsAppBotOffRampFlowService {
    private static FLOW_MODE: FlowMode = 'draft';
    private static FLOW_ID = '980070373602833';
    private static INITIAL_SCREEN = OffRampFlowScreens.AMOUNT_INPUT;

    public static async receiveDataExchange(
        requestBody: DecryptedFlowDataExchange['decryptedBody']
    ): Promise<DataExchangeResponse> {
        const { action, screen, data } = requestBody;

        if (action === 'INIT') {
            // Using Preview data because initialization should typically be done from `WhatsAppBotService.beginOffRampFlowMessage`
            return this.previewInitializationFlow(requestBody);
        }

        if (action === 'data_exchange') {
            let nextScreenData: Omit<DataExchangeResponse, 'version'> | undefined;

            switch (screen) {
                case OffRampFlowScreens.AMOUNT_INPUT:
                    nextScreenData = await this.getTransactionSummaryScreenData(
                        data as DataExchangedFromAmountInputScreen
                    );
                    break;

                case OffRampFlowScreens.TRANSACTION_SUMMARY:
                    nextScreenData = await this.getFeedbackScreenData(
                        data as DataExchangedFromTransactionSummaryScreen
                    );
                    break;
            }

            if (!nextScreenData) {
                throw new Error('Unhandled screen');
            }

            console.log(nextScreenData);

            return {
                ...nextScreenData,
                version: requestBody.version,
            };
        }

        throw new Error('Unhandled action');
    }

    private static generateTokenAmountPattern(
        amount: number,
        asset: AssetConfig,
        transactionFee: number
    ) {
        const tokenAmount: TokenAmountPattern = `${amount} ${asset.tokenName} (${asset.network})${SECTION_SEPARATOR}Fee = ${transactionFee} ${asset.tokenName}`;

        return tokenAmount;
    }

    private static generateFiatToReceivePattern(
        rate: number,
        currency: string,
        asset: AssetConfig,
        fiatAmount: number
    ) {
        return `${formatNumberAsCurrency(fiatAmount, currency)}${SECTION_SEPARATOR}1 ${asset.tokenName} = ${formatNumberAsCurrency(rate, currency)}` satisfies FiatToReceivePattern;
    }

    private static generateDestinationString(
        beneficiary: DataExchangedFromAmountInputScreen['beneficiary']
    ) {
        const { account_name, account_number, provider_name } = beneficiary;

        return `${account_number} | ${account_name} | ${provider_name}` satisfies DestinationPattern;
    }

    private static async getTransactionSummaryScreenData(
        input: DataExchangedFromAmountInputScreen
    ) {
        const { amount, asset_id, beneficiary, user_id } = input;

        const assetConfig = getAssetConfigOrThrow(asset_id);
        const { rate: conversionRate, fee } = await FiatRampService.getQuotes(
            beneficiary.currency_symbol,
            beneficiary.country_code as CountryCode,
            'offramp'
        );

        const amountAsNumber = parseFloat(amount.trim());
        const transactionFee = defaultAmountFixer(amountAsNumber * fee);

        const token_amount: TokenAmountPattern = this.generateTokenAmountPattern(
            amountAsNumber,
            assetConfig,
            transactionFee
        );
        const amountToDebit = defaultAmountFixer(amountAsNumber + transactionFee);

        const token_amount_to_debit: TokenAmountToDebitPattern = `${amountToDebit} ${assetConfig.tokenName}`;

        const destination_account = this.generateDestinationString(beneficiary);

        const fiatEquivalent = defaultAmountFixer(amountAsNumber * conversionRate);

        const fiat_to_receive: FiatToReceivePattern = this.generateFiatToReceivePattern(
            conversionRate,
            beneficiary.currency_symbol,
            assetConfig,
            fiatEquivalent
        );

        return {
            screen: OffRampFlowScreens.TRANSACTION_SUMMARY,
            data: {
                asset_id,
                user_id,
                display_data: {
                    token_amount,
                    token_amount_to_debit,
                    destination_account,
                    fiat_to_receive,
                },
                transaction_details: {
                    token_amount: amountAsNumber.toString(),
                    transaction_fee: transactionFee.toString(),
                    fiat_to_receive: fiatEquivalent.toString(),
                    beneficiary_id: beneficiary.id,
                    token_amount_to_debit: amountToDebit.toString(),
                },
            },
        };
    }

    private static async getFeedbackScreenData(input: DataExchangedFromTransactionSummaryScreen) {
        const {
            asset_id,
            token_amount,
            token_amount_to_debit,
            fiat_to_receive,
            beneficiary_id,
            user_id,
        } = input;
        const response = await this.processOffRampTransaction({
            assetId: asset_id,
            fiatAmount: parseFloat(fiat_to_receive),
            tokenAmount: parseFloat(token_amount),
            tokenAmountToDebit: parseFloat(token_amount_to_debit),
            beneficiaryId: beneficiary_id,
            userId: user_id,
        });

        return {
            screen:
                response.status === 'processing'
                    ? OffRampFlowScreens.PROCESSING_FEEDBACK
                    : OffRampFlowScreens.ERROR_FEEDBACK,
            data: {
                status: response.status[0].toUpperCase() + response.status.slice(1),
                message: response.message,
            },
        };
    }

    private static async processOffRampTransaction(params: {
        fiatAmount: number;
        userId: string;
        assetId: string;
        tokenAmount: number;
        tokenAmountToDebit: number;
        beneficiaryId: string;
    }): Promise<ProcessOfframpTransactionResponse> {
        const { fiatAmount, userId, assetId, tokenAmountToDebit, beneficiaryId, tokenAmount } =
            params;

        const assetConfig = getAssetConfigOrThrow(assetId);
        const walletInfo = await UserService.getUserAssetInfo(userId, assetId);
        const assetBalance = parseFloat(walletInfo.tokenBalance);

        if (assetBalance < tokenAmountToDebit) {
            const insufficientBalanceMessage = `You're trying to pay: ${tokenAmountToDebit} ${assetConfig.tokenName}\nYou have only: ${assetBalance} ${assetConfig.tokenName}`;

            return {
                status: 'failed',
                message: insufficientBalanceMessage,
            };
        }

        try {
            const { transactionId, hotWalletAddress } = await UserService.sendUserAssetForOfframp(
                {
                    walletAddress: walletInfo.walletAddress,
                    network: assetConfig.network,
                    tokenAddress: assetConfig.tokenAddress,
                    name: assetConfig.tokenName,
                    listItemId: assetId,
                },
                tokenAmountToDebit.toString()
            );

            // Process in background and return early processing response
            this.processOfframpInBackground(transactionId, {
                beneficiaryId,
                usdAmount: tokenAmount,
                localAmount: fiatAmount,
                tokenAddress: assetConfig.tokenAddress,
                chainName: assetConfig.network,
                tokenName: assetConfig.tokenName,
                userWalletAddress: walletInfo.walletAddress,
                hotWalletAddress,
            })
                .then(() => logger.info(`Offramp request sent for transactionId: ${transactionId}`))
                .catch((e) =>
                    logServiceError(e, `Offramp request failed for transactionId: ${transactionId}`)
                );

            return {
                status: 'processing',
                message:
                    "Your transaction is currently being processed, we'd send updates on the status of your transaction in your DM",
            };
        } catch (error) {
            logServiceError(error, 'Processing offramp transaction failed');

            return {
                status: 'failed',
                message: 'Transaction failed',
            };
        }
    }

    public static async processOfframpInBackground(
        onChainTransactionId: string,
        offrampParams: Omit<SendOfframpRequestPayload, 'txHash'>
    ) {
        const transactionDetails = await WalletKitService.getTransactionById(onChainTransactionId);

        if (transactionDetails.status === 'submitted') {
            setTimeout(() => {
                this.processOfframpInBackground(onChainTransactionId, offrampParams);
            }, 5000);
        }

        if (transactionDetails.status === 'success' && transactionDetails.transaction_hash) {
            try {
                await FiatRampService.postOfframpTransaction({
                    ...offrampParams,
                    txHash: transactionDetails.transaction_hash,
                    chainName: offrampParams.chainName.toUpperCase(),
                    tokenName: offrampParams.tokenName.toUpperCase(),
                });
            } catch (error) {
                logServiceError(error, 'Processing offramp transaction failed');
            }
        }
    }

    public static generateOffRampFlowInitMessage(params: {
        asset: AssetConfig;
        beneficiary: BankBeneficiary | MobileMoneyBeneficiary;
        recipient: string;
    }) {
        const { asset, beneficiary, recipient } = params;

        const assetLabel = `${asset.tokenName} (${asset.network})`;

        const beneficiaryName =
            'bankName' in beneficiary
                ? beneficiary.accountName
                : beneficiary.firstName + ' ' + beneficiary.lastName;
        const beneficiaryAccountNumber =
            'bankName' in beneficiary ? beneficiary.accountNumber : beneficiary.mobileNumber;
        const beneficiaryProvider =
            'bankName' in beneficiary ? beneficiary.bankName : beneficiary.mobileProvider;

        const sellMessage = `Sell ${assetLabel} for ${beneficiary.country.currencySymbol}`;

        const flowMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'flow',
                body: {
                    text: sellMessage,
                },
                action: {
                    name: 'flow',
                    parameters: {
                        flow_message_version: '3',
                        flow_token: crypto.randomBytes(16).toString('hex'),
                        flow_id: this.FLOW_ID,
                        mode: this.FLOW_MODE,
                        flow_cta: 'Sell Asset',
                        flow_action: 'navigate',
                        flow_action_payload: {
                            screen: this.INITIAL_SCREEN,
                            data: {
                                dynamic_page_title: sellMessage,
                                asset_label: assetLabel,
                                asset_id: asset.listItemId,
                                user_id: recipient,
                                beneficiary: {
                                    account_name: beneficiaryName,
                                    account_number: beneficiaryAccountNumber,
                                    provider_name: beneficiaryProvider,
                                    id: beneficiary.id,
                                    currency_symbol: beneficiary.country.currencySymbol,
                                    country_code: beneficiary.country.code,
                                } satisfies DataExchangedFromAmountInputScreen['beneficiary'],
                            },
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
            dynamic_page_title: 'Sell USDT (Base) for NGN',
            asset_label: 'USDT (Polygon)',
            asset_id: 'usdt-polygon',
            beneficiary: {
                id: 'rec_juyaqajdhdd',
                account_name: 'John Doe',
                account_number: '1234567890',
                provider_name: 'GTBank',
            },
        };

        return {
            screen: OffRampFlowScreens.AMOUNT_INPUT,
            data,
            version: requestBody.version,
        };
    }
}

export default WhatsAppBotOffRampFlowService;
