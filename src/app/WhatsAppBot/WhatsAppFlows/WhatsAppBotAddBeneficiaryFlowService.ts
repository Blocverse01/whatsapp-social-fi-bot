import { AssetConfig } from '@/Resources/web3/tokens';
import { WhatsAppInteractiveMessage } from '@/app/WhatsAppBot/WhatsAppBotType';
import crypto from 'node:crypto';
import { FlowMode } from '@/app/WhatsAppBot/WhatsAppFlows/types';

enum AddBeneficiaryFlowScreens {
    ACCOUNT_TYPE = 'ACCOUNT_TYPE',
    BANK_ACCOUNT_FORM = 'BANK_ACCOUNT_FORM',
    MOBILE_MONEY_FORM = 'MOBILE_MONEY_FORM',
    SUCCESS_FEEDBACK = 'SUCCESS_FEEDBACK',
    ERROR_FEEDBACK = 'ERROR_FEEDBACK',
}

class WhatsAppBotAddBeneficiaryFlowService {
    private static FLOW_MODE: FlowMode = 'draft';
    private static FLOW_ID = '482861261039877';
    private static INITIAL_SCREEN = AddBeneficiaryFlowScreens.ACCOUNT_TYPE;

    public static generateAddBeneficiaryFlowInitMessage(params: {
        asset: AssetConfig;
        countryCode: string;
        recipient: string;
        accountTypes: { id: string; title: string }[];
    }) {
        const { asset, countryCode, recipient, accountTypes } = params;

        const flowMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'flow',
                body: {
                    text: 'Click the button below to add a new beneficiary',
                },
                action: {
                    name: 'flow',
                    parameters: {
                        flow_message_version: '3',
                        flow_token: crypto.randomBytes(16).toString('hex'),
                        flow_id: this.FLOW_ID,
                        mode: this.FLOW_MODE,
                        flow_cta: 'Add Beneficiary',
                        flow_action: 'navigate',
                        flow_action_payload: {
                            screen: this.INITIAL_SCREEN,
                            data: {
                                account_types: accountTypes,
                                asset_id: asset.listItemId,
                                user_id: recipient,
                                country_code: countryCode,
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
}

export default WhatsAppBotAddBeneficiaryFlowService;
