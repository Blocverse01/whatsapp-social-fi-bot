import logger from '@/Resources/logger';
import {
    DataExchangeResponse,
    DecryptedFlowDataExchange,
    WhatsAppInteractiveMessage,
} from '@/app/WhatsAppBot/WhatsAppBotType';
import { UserAssetItem } from '@/app/User/userSchema';
import crypto from 'node:crypto';

type FlowMode = Required<WhatsAppInteractiveMessage['interactive']['action']>['parameters']['mode'];

class WhatsAppBotOffRampFlowService {
    private static FLOW_MODE: FlowMode = 'draft';
    private static FLOW_ID = '980070373602833';
    private static INITIAL_SCREEN = 'AMOUNT_INPUT';

    public static async receiveDataExchange(
        requestBody: DecryptedFlowDataExchange['decryptedBody']
    ): Promise<DataExchangeResponse> {
        const { action } = requestBody;

        if (action === 'INIT') {
            // Using Preview because initialization should typically be done
            return this.previewInitializationFlow(requestBody);
        }

        if (action === 'data_exchange') {
            logger.info('Data exchanged', requestBody.data);
        }

        throw new Error('Unhandled action');
    }

    public static generateOfframpFlowInitMessage(params: {
        asset: UserAssetItem;
        beneficiaryId: string;
        recipient: string;
    }) {
        const { asset, beneficiaryId, recipient } = params;

        const flowMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'flow',
                body: {
                    text: `Sell ${asset.name} (${asset.network})`,
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
                                asset_label: `${asset.name} (${asset.network})`,
                                asset_id: asset.listItemId,
                                beneficiary_id: beneficiaryId,
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
            beneficiary_id: 'rec_juyaqajdhdd',
        };

        return {
            screen: 'AMOUNT_INPUT',
            data,
            version: requestBody.version,
        };
    }
}

export default WhatsAppBotOffRampFlowService;
