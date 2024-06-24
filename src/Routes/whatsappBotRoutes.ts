import express from 'express';
import WhatsAppBotController from '@/app/WhatsAppBot/WhatsAppBotController';

const whatsappBotRoutes = express.Router();

whatsappBotRoutes
    .post('/messages/webhook', WhatsAppBotController.receiveMessageWebhook)
    .get('/messages/webhook', WhatsAppBotController.messageWebHookVerification);

export default whatsappBotRoutes;
