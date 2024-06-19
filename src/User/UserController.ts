import { Request, Response } from 'express';
import UserService from './UserService';
import { INTERNAL_SERVER_ERROR } from '@/constants/status-codes';
import WhatsAppBotService from '@/WhatsAppBot/WhatsAppBotService';
import env from '@/constants/env';

interface Message {
    from: string;
    id: string;
    timestamp: string;
    text?: {
        body: string;
    };
    type: string;
    interactive?: {
        type: 'button_reply';
        action: {
            buttons: Array<{
            type: 'reply';
            reply: {
                id: string;
                title: string;
            };
            }>;
        };
    }
}

class UserController {
    
    public static async userWebhook(req: Request, res: Response) {
        try {
            const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
            const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
  
            console.log(`message : ${message} ---- ${business_phone_number_id}`);
            
            await UserController.messageTypeCheck(message,business_phone_number_id, 'Hello');

        } catch (error:any) {
            console.log(error);
            console.log(error.response);
        }
    }

   public static async userWebHookVerification(req:Request,res:Response) {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        // check the mode and token sent are correct
        if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
            // respond with 200 OK and challenge token from the request
            res.status(200).send(challenge);
            console.log("Webhook verified successfully!");
        } else {
            // respond with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }

    public static async messageTypeCheck(message: any, businessPhoneNumberId: string, displayName : string) {
        
        const { id, type, from, text, interactive } = message;

        console.log(`message : ${message} ---- ${type}`);

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


export default UserController;