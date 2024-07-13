import express from 'express';
import WhatsAppBotController from '@/app/WhatsAppBot/WhatsAppBotController';
import logger from '@/Resources/logger';
import WhatsAppBotService from '@/app/WhatsAppBot/WhatsAppBotService';

const whatsappBotRoutes = express.Router();

whatsappBotRoutes
    .post('/messages/webhook', WhatsAppBotController.receiveMessageWebhook)
    .get('/messages/webhook', WhatsAppBotController.messageWebHookVerification)
    // TODO: Remove this endpoint
    .post('/sample-flow-endpoint', (req, res) => {
        let decryptedRequest = null;
        try {
            decryptedRequest = WhatsAppBotService.decryptFlowRequest(req.body);
        } catch (err) {
            console.error(err);
            return res.status(500).send();
        }

        const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
        logger.info('Received Flow', req.body);

        logger.info('💬 Decrypted Request:', decryptedBody);

        const screenResponse = {
            version: decryptedBody.version,
            data: {
                status: 'active',
            },
        };
        console.log('👉 Response to Encrypt:', screenResponse);

        res.send(
            WhatsAppBotService.encryptFlowResponse(
                screenResponse,
                aesKeyBuffer,
                initialVectorBuffer
            )
        );
    });

export default whatsappBotRoutes;
