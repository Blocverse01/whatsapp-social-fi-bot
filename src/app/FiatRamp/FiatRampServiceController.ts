import { Request, Response } from 'express';
import { transactionWebhookPayloadSchema } from '@/app/FiatRamp/fiatRampSchema';
import { OK } from '@/constants/status-codes';
import { handleRequestError } from '@/Resources/requestHelpers/handleRequestError';
import { prettifyNumber } from '@/Resources/utils/currency';
import WhatsAppBotService from '@/app/WhatsAppBot/WhatsAppBotService';
import logger from '@/Resources/logger';

class FiatRampServiceController {
    // TODO: replace with better authorization guards
    private static ALLOWED_IPS = ['3.75.158.163', '3.125.183.140', '35.157.117.28'];

    public static async receiveTransactionWebhook(req: Request, res: Response) {
        try {
            //get the origin IP of the request
            let originIp;
            const forwardedIps = req.headers['x-forwarded-for']?.toString().split(',');
            if (forwardedIps) {
                originIp = forwardedIps[0]; // Take the first IP address from X-Forwarded-For header
            } else {
                originIp = req.ip; // Fallback to req.ip if X-Forwarded-For is not available
            }

            logger.debug('Received transaction webhook', {
                originIp,
                body: req.body,
            });

            //check if the request is coming from an allowed IP
            if (!FiatRampServiceController.ALLOWED_IPS.includes(originIp as string)) {
                return res.status(401).send('Unauthorized');
            }

            res.sendStatus(OK);

            const payload = transactionWebhookPayloadSchema.parse(req.body);

            const { transactionStatus } = payload;

            const transactionKeyword = payload.transactionType === 'off-ramp' ? 'Sell' : 'Buy';

            const transactionDetailsString = `💲${transactionKeyword} ${payload.usdAmount} ${payload.tokenName} on ${payload.chainName} for ${payload.localCurrencySymbol} ${prettifyNumber(payload.localAmount)}`;

            let message = '';

            if (transactionStatus === 'complete') {
                message = `✅ Your transaction with the following details has been completed:\n\n${transactionDetailsString}\n\nExpect your funds within 1 - 5 minutes`;
            }
            if (transactionStatus === 'failed') {
                message = `❌ Your transaction with the following details has failed:\n\n${transactionDetailsString}\n\nPlease contact support for assistance`;
            }

            if (transactionStatus === 'processing') {
                message = `⏳ Your transaction with the following details is being processed:\n\n${transactionDetailsString}\n\nPlease be patient`;
            }

            if (message.trim())
                await WhatsAppBotService.sendArbitraryTextMessage(
                    payload.transactionOwnerId,
                    message
                );
        } catch (error) {
            handleRequestError(error, res, true);
        }
    }
}

export default FiatRampServiceController;
