import { Request, Response } from 'express';
import env from '@/constants/env';
import WhatsAppBotService from '@/WhatsAppBot/WhatsAppBotService';
import UserService from '@/User/UserService';
import logger from '@/Resources/logger';

class WhatsAppBotController {
    public static async receiveMessageWebhook(req: Request, res: Response) {
        try {
            // const {
            //         entry: [{
            //             changes: [{
            //             value: {
            //                 metadata: { phone_number_id: businessPhoneNumberId },
            //                 messages : [message],
            //                 contacts: [{ profile: { name: displayName = null } }]
            //             }
            //             }]
            //         }]
            // } = req.body;

            logger.info('Received Whatsapp Message',{
                webhookBody: req.body
            });

            const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
            const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

            logger.info(`message : ${message} ---- ${business_phone_number_id}`);

            if (message.length > 0) {
                await WhatsAppBotController.messageTypeCheck(message,business_phone_number_id, 'Hello');
            } else {
                 logger.info('Message object not found');
            }

        } catch (error:any) {
            console.log(error);
            console.log(error.response);
        }
    }

    public static async messageWebHookVerification(req:Request, res:Response) {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        // check the mode and token sent are correct
        if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
            // respond with 200 OK and challenge token from the request
            res.status(200).send(challenge);
            logger.info("Webhook verified successfully!");
        } else {
            // respond with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }

    public static async messageTypeCheck(message: any, businessPhoneNumberId: string, displayName : string) {

        const { id, type, from, text, interactive } = message;

        logger.info(`message : ${message} ---- ${type}`);

        await WhatsAppBotService.markMassageAsRead(businessPhoneNumberId, id);

        if (type === "text") {
            await WhatsAppBotService.createWalletMessage(
                businessPhoneNumberId,
                displayName,
                from
            );
        } else if (type === 'interactive') {
            if (interactive && interactive.type === 'button_reply') {
                const { type: interactiveType, action: { buttons } } = interactive;
                const [{ reply: { id: interactiveId } }] = buttons;
                if (interactiveId === 'create-wallet') {
                    await UserService.createUser(from,displayName);
                }
            } else {
                console.log("No interactive message found or type is not 'button_reply'.");
            }
        }

    }
}

export default WhatsAppBotController;