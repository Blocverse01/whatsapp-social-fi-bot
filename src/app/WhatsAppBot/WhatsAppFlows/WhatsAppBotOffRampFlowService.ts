import logger from '@/Resources/logger';
import { DataExchangeResponse, DecryptedFlowDataExchange } from '@/app/WhatsAppBot/WhatsAppBotType';

class WhatsAppBotOffRampFlowService {
    public static async receiveDataExchange(
        requestBody: DecryptedFlowDataExchange['decryptedBody']
    ): Promise<DataExchangeResponse> {
        const { action } = requestBody;

        if (action === 'INIT') {
            return this.handleInitializingFlow(requestBody);
        }

        if (action === 'data_exchange') {
            logger.info('Data exchanged', requestBody.data);
        }

        throw new Error('Unhandled action');
    }

    public static handleInitializingFlow(requestBody: DecryptedFlowDataExchange['decryptedBody']) {
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
