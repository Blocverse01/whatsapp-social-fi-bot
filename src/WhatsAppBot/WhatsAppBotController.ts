import { Request, Response } from 'express';
import env from '@/constants/env';
import WhatsAppBotService from '@/WhatsAppBot/WhatsAppBotService';
import UserService from '@/User/UserService';
import logger from '@/Resources/logger';
import { OK } from '@/constants/status-codes';


type Message = {
    id: string;
    type: string;
    from: string;
    text: string;
    interactive: {
        type: string;
        action: {
            buttons: [
                {
                    reply: {
                        id: string;
                    };
                },
            ];
        };
    };
}

interface WebhookRequestBody {
    entry: [
        {
            changes: [
                {
                    value: {
                        metadata: {
                            phone_number_id: string;
                        };
                        messages: [Message];
                        contacts: [
                            {
                                profile: {
                                    name: string;
                                };
                            },
                        ];
                    };
                },
            ];
        },
    ];
}

class WhatsAppBotController {
    public static async receiveMessageWebhook(req: Request, res: Response) {
        try {
            res.sendStatus(OK);

            const messageParts = WhatsAppBotController.extractStringMessageParts(req.body);

            const { message, displayName, businessPhoneNumberId } = messageParts;

            logger.info('Original Body Received', {
                webhookBody: req.body,
            });

            logger.info('Extracted message parts', {
                messageParts,
            });

            if (message && message.id) {
                await WhatsAppBotController.messageTypeCheck(
                    messageParts.message,
                    messageParts.businessPhoneNumberId,
                    messageParts.displayName
                );
            } else {
                logger.info('Message object not found');
            }
        } catch (error) {
            logger.error('Error in receiving message webhook', {
                error
            });
        }
    }

    private static extractStringMessageParts(requestBody: WebhookRequestBody) {
        const firstEntry = requestBody.entry[0];

        const firstChange = firstEntry.changes[0];
        const firstValue = firstChange.value;

        const businessPhoneNumberId = firstChange.value.metadata.phone_number_id;

        const message = firstChange.value.messages[0];

        const displayName = firstChange.value.contacts[0].profile.name;

        return { businessPhoneNumberId, message, displayName };
    }

    public static async messageWebHookVerification(req: Request, res: Response) {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        // check the mode and token sent are correct
        if (mode === 'subscribe' && token === env.WEBHOOK_VERIFY_TOKEN) {
            // respond with 200 OK and challenge token from the request
            res.status(200).send(challenge);
            logger.info('Webhook verified successfully!');
        } else {
            // respond with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }

    public static async messageTypeCheck(
        message: Message,
        businessPhoneNumberId: string,
        displayName: string
    ) {
        logger.info(`type of message : ${typeof message}`);

        const { id, type, from, text, interactive } = message;

        logger.info(`message : ${message} ---- ${type}`);

        await WhatsAppBotService.markMassageAsRead(businessPhoneNumberId, id);

        if (type === 'text') {
            await WhatsAppBotService.createWalletMessage(businessPhoneNumberId, displayName, from);
        } else if (type === 'interactive') {
            if (interactive && interactive.type === 'button_reply') {
                const {
                    type: interactiveType,
                    action: { buttons },
                } = interactive;

                const [
                    {
                        reply: { id: interactiveId },
                    },
                ] = buttons;

                if (interactiveId === 'create-wallet') {
                    await UserService.createUser(from, displayName);
                }
            } else {
                logger.info("No interactive message found or type is not 'button_reply'.");
            }
        }
    }
}

export default WhatsAppBotController;
