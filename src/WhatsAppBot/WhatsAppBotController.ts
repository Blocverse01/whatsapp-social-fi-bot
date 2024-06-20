import { Request, Response } from 'express';
import env from '@/constants/env';
import WhatsAppBotService from '@/WhatsAppBot/WhatsAppBotService';
import UserService from '@/User/UserService';
import logger from '@/Resources/logger';
import { OK } from '@/constants/status-codes';
import FiatRampService from '@/app/FiatRamp/FiatRampService';

type Message = {
    id: string;
    type: string;
    from: string;
    text: string;
    interactive: {
        type: 'button_reply' | 'list_reply';
         list_reply?: {
             id: string;
             title: string;
             description: string;
        },
        button_reply?: {
            id: string;
            title: string;
        };
    };
};

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
            logger.info('Original Body Received', {
                webhookBody: req.body,
            });

            const messageParts = WhatsAppBotController.extractStringMessageParts(req.body);

            const { message, displayName, businessPhoneNumberId } = messageParts;

            const _ = message?.id
                ? await WhatsAppBotService.markMassageAsRead(businessPhoneNumberId, message.id)
                : null;

            logger.info('Extracted message parts', {
                messageParts,
            });

            if (message && message.id && businessPhoneNumberId && displayName) {
                await WhatsAppBotController.messageTypeCheck(
                    message,
                    businessPhoneNumberId,
                    displayName
                );
            } else {
                logger.info('Message object not found');
            }
        } catch (error) {
            logger.error('Error in receiving message webhook', {
                error,
            });
        }
    }

    private static extractStringMessageParts(requestBody: WebhookRequestBody) {
        const firstEntry = requestBody.entry![0] ?? undefined;

        const firstChange = firstEntry?.changes![0];

        const firstChangeValue = firstChange?.value;

        if (!firstChangeValue) {
            logger.info('Un-extracted request body', requestBody);

            return {};
        }

        const businessPhoneNumberId = firstChangeValue.metadata.phone_number_id;

        const message = firstChangeValue.messages[0];

        const displayName = firstChangeValue.contacts[0].profile.name;

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

        logger.info(`message : ${type}`);

        if (type === 'text') {
            const user = await UserService.getUser(from);
            if (user) {
                const userWallets = await UserService.getUserWalletAssetsList(from);
                await WhatsAppBotService.listWalletAddressMessage(
                        businessPhoneNumberId,
                        displayName,
                        from,
                        userWallets,
                        'old_account'
                );
            } else {
                await WhatsAppBotService.createWalletMessage(
                    businessPhoneNumberId,
                    displayName,
                    from
                );
            }
           
        } else if (type === 'interactive') {
            logger.info(`message-interactive : ${JSON.stringify(interactive)}`);

            if (interactive && interactive.type === 'button_reply') {
                const { button_reply } = interactive;

                const interactiveId = button_reply?.id as string;
                const userWalletId = ['explore-eth', 'explore-usdc-base'];

                if (interactiveId === 'create-wallet') {
                    const createdNewUser = await UserService.createUser(from, displayName);

                    if (createdNewUser) {
                        const userAssetsList = await UserService.createUserWallets(from);

                        await WhatsAppBotService.listWalletAddressMessage(
                            businessPhoneNumberId,
                            displayName,
                            from,
                            userAssetsList,
                            'new_account'
                        );
                    }
                } else if (userWalletId.includes(interactiveId)) {

                    const userAssetInfo = await UserService.getUserAssetInfo(from, interactiveId);
                    
                        await WhatsAppBotService.walletDetailsMessage(
                            businessPhoneNumberId,
                            from,
                            userAssetInfo
                        );
                }
            } else if (interactive && interactive.type === 'list_reply') {
                
                const usersBeneficiaries = await FiatRampService.getBeneficiaries(
                    from,
                    'NG',
                    'bank'
                );

                await WhatsAppBotService.listBeneficiaryMessage(
                    businessPhoneNumberId,
                    from,
                    usersBeneficiaries
                );
            }else {
                logger.info("No interactive message found or type is not 'button_reply'.");
            }
        }
    }
}

export default WhatsAppBotController;
