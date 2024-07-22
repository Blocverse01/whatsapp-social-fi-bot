import {
    DataExchangeResponse,
    DecryptedFlowDataExchange,
    WhatsAppInteractiveMessage,
} from '@/app/WhatsAppBot/WhatsAppBotType';
import crypto from 'node:crypto';
import { AssetConfig, getAssetConfigOrThrow, TokenNames } from '@/Resources/web3/tokens';
import { SupportedChain } from '@/app/WalletKit/walletKitSchema';
import { TRANSACTION_FEE_PERCENTAGE } from '@/constants/numbers';
import FiatRampService from '@/app/FiatRamp/FiatRampService';
import { BankBeneficiary, MobileMoneyBeneficiary } from '@/app/FiatRamp/fiatRampSchema';
import { defaultAmountFixer, formatNumberAsCurrency } from '@/Resources/utils/currency';
import UserService from '@/app/User/UserService';

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
    };
    asset_label: string;
};
type DataExchangedFromTransactionSummaryScreen = {
    asset_id: string;
    token_amount_to_debit: string;
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
                    nextScreenData = await this.getProcessingFeedbackScreenData(
                        data as DataExchangedFromTransactionSummaryScreen
                    );
                    break;
            }

            if (!nextScreenData) {
                throw new Error('Unhandled screen');
            }

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
        const { amount, asset_id, beneficiary, asset_label } = input;

        const assetConfig = getAssetConfigOrThrow(asset_id);

        const amountAsNumber = parseFloat(amount.trim());
        const transactionFee = defaultAmountFixer(amountAsNumber * TRANSACTION_FEE_PERCENTAGE);
        const token_amount: TokenAmountPattern = this.generateTokenAmountPattern(
            amountAsNumber,
            assetConfig,
            transactionFee
        );
        const amountToDebit = defaultAmountFixer(amountAsNumber + transactionFee);

        const token_amount_to_debit: TokenAmountToDebitPattern = `${amountToDebit} ${assetConfig.tokenName}`;

        const destination_account = this.generateDestinationString(beneficiary);

        const conversionRate = await FiatRampService.getSellRate(beneficiary.currency_symbol);

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

    private static async getProcessingFeedbackScreenData(
        input: DataExchangedFromTransactionSummaryScreen
    ) {
        const {
            asset_id,
            token_amount_to_debit,
            fiat_to_receive,
            beneficiary_id,
            transaction_fee,
            user_id,
        } = input;

        const assetConfig = getAssetConfigOrThrow(asset_id);

        const walletInfo = await UserService.getUserAssetInfo(user_id, asset_id);

        console.log({ walletInfo });

        return {
            screen: OffRampFlowScreens.PROCESSING_FEEDBACK,
            data: {
                status: 'Processing',
            },
        };
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
