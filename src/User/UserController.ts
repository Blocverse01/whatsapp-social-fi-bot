import { Request, Response } from 'express';
import UserService from './UserService';
import { INTERNAL_SERVER_ERROR } from '@/constants/status-codes';
import WhatsAppBotService from '@/WhatsAppBot/WhatsAppBotService';

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

    async userWebhook(req: Request, res: Response) {
        try {
            const {
                    entry: [{
                        changes: [{
                        value: {
                            metadata: { phone_number_id: businessPhoneNumberId },
                            messages : [message],
                            contacts: [{ profile: { name: displayName = null } }]
                        }
                        }]
                    }]
            } = req.body;
            
            await this.messageTypeCheck(message,businessPhoneNumberId, displayName);

        } catch (error:any) {
            return res.status(error?.status ?? INTERNAL_SERVER_ERROR).json({ message: error.message });
        }
    }

    async messageTypeCheck(message: Message[], businessPhoneNumberId: string, displayName : string) {
        
        const [{ id, type, from, text, interactive }] = message;

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


export default new UserController();