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
    beneficiary: {
        id: string;
        account_name: string;
        account_number: string;
        provider_name: string;
        currency_symbol: string;
    };
    asset_label: string;
};

type TokenAmountPattern =
    `${number} ${TokenNames} (${SupportedChain})\n---------------------------------\nFee = ${number} ${TokenNames}`;
type TokenAmountToDebitPattern = `${number} ${TokenNames}`;
type DestinationPattern = `${string} | ${string} | ${string}`;
type FiatToReceivePattern =
    `${string} ${string}\n---------------------------------\n1 ${TokenNames} = ${string} ${string}`;

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
            switch (screen) {
                case OffRampFlowScreens.AMOUNT_INPUT:
                    const nextScreenData = await this.getTransactionSummaryScreenData(
                        data as DataExchangedFromAmountInputScreen
                    );

                    return {
                        ...nextScreenData,
                        version: requestBody.version,
                    };
            }
        }

        throw new Error('Unhandled action');
    }

    private static generateTokenAmountPattern(
        amount: string,
        asset: AssetConfig,
        transactionFee: number
    ) {
        const amountAsNumber = parseFloat(amount);

        const tokenAmount: TokenAmountPattern = `${amountAsNumber} ${asset.tokenName} (${asset.network})${SECTION_SEPARATOR}Fee = ${transactionFee} ${asset.tokenName}`;

        return tokenAmount;
    }

    private static generateFiatToReceivePattern(
        rate: number,
        currency: string,
        asset: AssetConfig,
        fiatAmount: number
    ) {
        return `${currency} ${fiatAmount}${SECTION_SEPARATOR}1 ${asset.tokenName} = ${currency} ${rate}` satisfies FiatToReceivePattern;
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

        const amountAsNumber = parseFloat(amount);
        const transactionFee = Number((amountAsNumber * TRANSACTION_FEE_PERCENTAGE).toFixed(2));
        const token_amount: TokenAmountPattern = this.generateTokenAmountPattern(
            amount,
            assetConfig,
            transactionFee
        );
        const amountToDebit = Number((amountAsNumber + transactionFee).toFixed(2));

        const token_amount_to_debit: TokenAmountToDebitPattern = `${amountToDebit} ${assetConfig.tokenName}`;

        const destination_account = this.generateDestinationString(beneficiary);

        const conversionRate = await FiatRampService.getSellRate(beneficiary.currency_symbol);

        const fiatEquivalent = Number((amountAsNumber * conversionRate).toFixed(2));

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
                asset_label,
                token_amount,
                token_amount_to_debit,
                destination_account,
                fiat_to_receive,
                beneficiary_id: beneficiary.id,
                transaction_fee: `${transactionFee} ${assetConfig.tokenName}`,
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

        const flowMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'flow',
                body: {
                    text: `Sell ${assetLabel}`,
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
                                asset_label: assetLabel,
                                asset_id: asset.listItemId,
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
