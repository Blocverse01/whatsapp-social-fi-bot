import { Request, Response } from 'express';
import env from '@/constants/env';
import WhatsAppBotService from '@/app/WhatsAppBot/WhatsAppBotService';
import UserService from '@/app/User/UserService';
import logger from '@/Resources/logger';
import { OK } from '@/constants/status-codes';
import FiatRampService from '@/app/FiatRamp/FiatRampService';
import {
    extractSellAssetDestinationChoiceGroups,
    extractSellAssetToBeneficiaryGroups,
    SELL_BENEFICIARY_AMOUNT_PATTERN,
} from '@/constants/regex';
import { isAxiosError } from 'axios';
import {
    ASSET_ACTION_REGEX_PATTERN,
    AssetActionRegexMatch,
    MORE_CURRENCIES_COMMAND_REGEX_PATTERN,
    MoreCurrenciesCommandMatch,
    RATES_COMMAND,
    WhatsAppMessageType,
} from '@/app/WhatsAppBot/WhatsAppBotType';
import { handleRequestError } from '@/Resources/requestHelpers/handleRequestError';
import { requestDecryptedDataFlowExchange } from '@/Resources/requestHelpers/requestPropsGuard';
import WhatsAppBotOffRampFlowService from '@/app/WhatsAppBot/WhatsAppFlows/WhatsAppBotOffRampFlowService';

type Message = {
    id: string;
    type: string;
    from: string;
    text: {
        body: string;
    };
    interactive: {
        type: 'button_reply' | 'list_reply';
        list_reply?: {
            id: string;
            title: string;
            description: string;
        };
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
            console.log(error);

            if (isAxiosError(error)) {
                logger.error('Error in receiving message webhook', {
                    errorResponse: error.response,
                });

                return;
            }

            logger.error('Error in receiving message webhook', {
                error: JSON.stringify(error),
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

        // ============== HANDLE TEXT MESSAGES ============== //
        if (type === WhatsAppMessageType.TEXT) {
            if (text.body.toLowerCase() === RATES_COMMAND) {
                await WhatsAppBotService.ratesCommandHandler(from, businessPhoneNumberId);
                return;
            }

            const user = await UserService.userExists(from);

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

            return;
        }
        // ============== END OF HANDLING TEXT MESSAGES ============== //

        // ============== HANDLE INTERACTIVE MESSAGES ============== //
        if (type === WhatsAppMessageType.INTERACTIVE && interactive) {
            logger.info(`message-interactive : ${JSON.stringify(interactive)}`);

            if (interactive.type === 'button_reply' && interactive.button_reply) {
                const { button_reply } = interactive;

                const interactiveButtonId = button_reply.id;

                const interactiveActionResponse =
                    WhatsAppBotService.determineInteractiveButtonReplyAction(interactiveButtonId);

                switch (interactiveActionResponse) {
                    case 'create-wallet':
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
                        return;

                    case 'explore-asset':
                        const userAssetInfo = await UserService.getUserAssetInfo(
                            from,
                            interactiveButtonId
                        );
                        await WhatsAppBotService.walletDetailsMessage(
                            businessPhoneNumberId,
                            from,
                            userAssetInfo
                        );
                        return;

                    case 'demo-withdraw-amount-to-beneficiary':
                        const { sell, beneficiaryId, amount } = interactiveButtonId.match(
                            SELL_BENEFICIARY_AMOUNT_PATTERN
                        )?.groups as { sell: string; beneficiaryId: string; amount: string };

                        await WhatsAppBotService.processTransactionInDemoMode(
                            from,
                            businessPhoneNumberId,
                            {
                                assetId: sell,
                                beneficiaryId,
                                usdAmount: amount,
                            }
                        );

                        return;

                    case 'sell-asset-destination-choice':
                        const { sell: assetId, beneficiaryAction } =
                            extractSellAssetDestinationChoiceGroups(interactiveButtonId);

                        if (beneficiaryAction === 'chooseExisting') {
                            const usersBeneficiaries = await FiatRampService.getBeneficiaries(
                                from,
                                'NG',
                                'bank'
                            );

                            await WhatsAppBotService.listBeneficiaryMessage(
                                businessPhoneNumberId,
                                from,
                                usersBeneficiaries,
                                assetId
                            );
                        }

                        if (beneficiaryAction === 'addNew') {
                            // TODO: handle adding new beneficiary
                        }

                        return;
                }
            }

            if (interactive.type === 'list_reply' && interactive.list_reply) {
                const phoneParams = { userPhoneNumber: from, businessPhoneNumberId };

                const { list_reply } = interactive;

                const interactiveListId = list_reply.id;

                const interactiveActionResponse =
                    WhatsAppBotService.determineInteractiveListReplyAction(interactiveListId);

                logger.info('Interactive list reply action', {
                    interactiveActionResponse,
                    interactiveListId,
                });

                switch (interactiveActionResponse) {
                    case 'trigger-offramp-flow':
                        const { sell, beneficiaryId } =
                            extractSellAssetToBeneficiaryGroups(interactiveListId);

                        await WhatsAppBotService.beginOffRampFlowMessage({
                            businessPhoneNumberId,
                            recipient: from,
                            assetId: sell,
                            beneficiaryId,
                        });
                        return;

                    case 'return-more-currencies':
                        const [
                            __interactiveListId,
                            assetActionId,
                            purchaseAssetId,
                            nextSliceFrom,
                            nextSliceTo,
                        ] = interactiveListId.match(
                            MORE_CURRENCIES_COMMAND_REGEX_PATTERN
                        ) as MoreCurrenciesCommandMatch;

                        await WhatsAppBotService.sendSelectSupportedCurrenciesMessage(
                            phoneParams,
                            assetActionId,
                            purchaseAssetId,
                            parseInt(nextSliceFrom),
                            parseInt(nextSliceTo)
                        );

                        return;

                    case 'explore-asset':
                        const userAssetInfo = await UserService.getUserAssetInfo(
                            from,
                            interactiveListId
                        );
                        await WhatsAppBotService.walletDetailsMessage(
                            businessPhoneNumberId,
                            from,
                            userAssetInfo
                        );
                        return;

                    case 'explore-asset-action':
                        const [_interactiveListId, assetAction, assetId] = interactiveListId.match(
                            ASSET_ACTION_REGEX_PATTERN
                        ) as AssetActionRegexMatch;

                        logger.info('Explore asset regex groups', {
                            regexMatch: [_interactiveListId, assetAction, assetId],
                        });

                        if (assetAction === 'sell') {
                            await WhatsAppBotService.offrampDestinationChoiceMessage(
                                {
                                    userPhoneNumber: from,
                                    businessPhoneNumberId,
                                },
                                assetId
                            );

                            return;
                        }

                        if (assetAction === 'buy') {
                            await WhatsAppBotService.handleBuyAssetAction(
                                { userPhoneNumber: from, businessPhoneNumberId },
                                assetId
                            );

                            return;
                        }

                        if (assetAction === 'withdraw') {
                            // TODO: handle withdraw asset to wallet
                        }

                        if (assetAction === 'deposit') {
                            await WhatsAppBotService.depositAssetCommandHandler(
                                from,
                                businessPhoneNumberId,
                                assetId
                            );
                        }

                        return;
                }
            }
        }
    }

    public static async offrampFlowDataExchange(req: Request, res: Response) {
        try {
            const { decryptedBody, initialVectorBuffer, aesKeyBuffer } =
                requestDecryptedDataFlowExchange(req);

            const response = await WhatsAppBotOffRampFlowService.receiveDataExchange(decryptedBody);

            return res.send(
                WhatsAppBotService.encryptFlowResponse(response, {
                    initialVectorBuffer,
                    aesKeyBuffer,
                })
            );
        } catch (error) {
            handleRequestError(error, res);
        }
    }
}

export default WhatsAppBotController;
