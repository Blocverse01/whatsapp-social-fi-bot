import express from 'express';
import WhatsAppBotController from '@/app/WhatsAppBot/WhatsAppBotController';
import decryptFlowDataExchange from '@/Resources/middlewares/decryptFlowDataExchange';

const whatsappBotRoutes = express.Router();

whatsappBotRoutes
    .post('/messages/webhook', WhatsAppBotController.receiveMessageWebhook)
    .get('/messages/webhook', WhatsAppBotController.messageWebHookVerification)
    .post(
        '/flows/offramp-data-exchange',
        decryptFlowDataExchange,
        WhatsAppBotController.offrampFlowDataExchange
    );

export default whatsappBotRoutes;
