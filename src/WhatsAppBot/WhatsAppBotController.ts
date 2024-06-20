import { Request, Response } from 'express';
import env from '@/constants/env';
import WhatsAppBotService from '@/WhatsAppBot/WhatsAppBotService';
import UserService from '@/User/UserService';
import logger from '@/Resources/logger';
import { OK } from '@/constants/status-codes';
import FiatRampService from '@/app/FiatRamp/FiatRampService';
import { WhatsAppMessageType, WhatsAppTextMessage } from '@/WhatsAppBot/WhatsAppBotType';
import { SELL_BENEFICIARY__AMOUNT_PATTERN } from '@/constants/regex';
import WalletKitService from '@/app/WalletKit/WalletKitService';
import { TokenNames } from '@/Resources/web3/tokens';
import { parseUnits, toHex } from 'viem';

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
            if (text.body.toLowerCase() === 'rates') {
                await WhatsAppBotController.ratesCommandHandler(from, businessPhoneNumberId);
                return;
            }

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
                const { button_reply, list_reply } = interactive;

                const interactiveButtonId = button_reply?.id as string;
                const userWalletId = ['explore-eth', 'explore-usdc-base'];
                const userSellAssetId = ['sell:explore-eth', 'sell:explore-usdc-base'];
                const userDepositAssetIds = ['buy:explore-eth', 'buy:explore-usdc-base'];

                if (interactiveButtonId === 'create-wallet') {
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
                } else if (userWalletId.includes(interactiveButtonId)) {
                    const userAssetInfo = await UserService.getUserAssetInfo(
                        from,
                        interactiveButtonId
                    );
                    await WhatsAppBotService.walletDetailsMessage(
                        businessPhoneNumberId,
                        from,
                        userAssetInfo
                    );
                } else if (userSellAssetId.includes(interactiveButtonId)) {
                    const usersBeneficiaries = await FiatRampService.getBeneficiaries(
                        from,
                        'NG',
                        'bank'
                    );

                    await WhatsAppBotService.listBeneficiaryMessage(
                        businessPhoneNumberId,
                        from,
                        usersBeneficiaries,
                        interactiveButtonId
                    );
                } else if (userDepositAssetIds.includes(interactiveButtonId)) {
                    await WhatsAppBotController.depositAssetCommandHandler(
                        from,
                        businessPhoneNumberId,
                        interactiveButtonId.split(':')[1]
                    );
                } else if (interactiveButtonId.match(SELL_BENEFICIARY__AMOUNT_PATTERN)) {
                    const { sell, beneficiaryId, amount } = interactiveButtonId.match(
                        SELL_BENEFICIARY__AMOUNT_PATTERN
                    )?.groups as { sell: string; beneficiaryId: string; amount: string };

                    await WhatsAppBotController.processTransactionInDemoMode(
                        from,
                        businessPhoneNumberId,
                        {
                            assetId: sell,
                            beneficiaryId,
                            usdAmount: amount,
                        }
                    );
                    return;
                }
            } else if (interactive && interactive.type === 'list_reply') {
                const { list_reply } = interactive;
                const interactiveListId = list_reply?.id as string;

                logger.info(`off-ramp-data : ${interactiveListId}`);

                await WhatsAppBotService.selectAmountMessage(
                    businessPhoneNumberId,
                    from,
                    interactiveListId
                );
            } else {
                logger.info("No interactive message found or type is not 'button_reply'.");
            }
        }
    }

    public static async ratesCommandHandler(
        userPhoneNumber: string,
        businessPhoneNumberId: string
    ) {
        const targetCurrencies = ['NGN', 'KES', 'GHS', 'ZAR', 'UGX'];
        const rates = await FiatRampService.getMultipleRates(targetCurrencies);

        const messagePayload: WhatsAppTextMessage = {
            type: WhatsAppMessageType.TEXT,
            text: {
                body: `Conversion Rates\n\n${rates.map((rate) => `==================\n${rate.code}/USDC\nBuy: ${rate.buy}\nSell: ${rate.sell}`).join('\n\n')}`,
                preview_url: false,
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await WhatsAppBotService.sendWhatsappMessage(
            'POST',
            `${businessPhoneNumberId}/messages`,
            messagePayload
        );
    }

    public static async depositAssetCommandHandler(
        userPhoneNumber: string,
        businessPhoneNumberId: string,
        listItemId: string
    ) {
        const asset = await UserService.getUserWalletAssetOrThrow(userPhoneNumber, listItemId);

        const messagePayload: WhatsAppTextMessage = {
            type: WhatsAppMessageType.TEXT,
            text: {
                body: `${asset.walletAddress}`,
                preview_url: false,
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await WhatsAppBotService.sendWhatsappMessage(
            'POST',
            `${businessPhoneNumberId}/messages`,
            messagePayload
        );
    }

    public static async processTransactionInDemoMode(
        userPhoneNumber: string,
        businessPhoneNumberId: string,
        params: { assetId: string; beneficiaryId: string; usdAmount: string }
    ) {
        const asset = await UserService.getUserWalletAssetOrThrow(userPhoneNumber, params.assetId);

        // Can only offramp USDC in demo mode
        if (asset.name !== TokenNames.USDC_BASE) {
            return;
        }

        const quote = await FiatRampService.getQuotes('NGN', 'NG', 'offramp');

        const numericUsdAmount = parseFloat(params.usdAmount);
        const fiatAmountToReceive = (quote.rate * numericUsdAmount).toFixed(2);

        const cryptoAmountToDebit = (numericUsdAmount + numericUsdAmount * quote.fee).toFixed(2);

        const { transactionId, hotWalletAddress } = await UserService.sendUserAssetForOfframp(
            asset,
            cryptoAmountToDebit,
            6
        );

        const messagePayload: WhatsAppTextMessage = {
            type: WhatsAppMessageType.TEXT,
            text: {
                body: `??Processing Bank Account Withdrawal\n\nAsset:${asset.name}\nAmount: ${cryptoAmountToDebit} USDC\nEquivalent: ${fiatAmountToReceive} NGN\nTransaction ID: ${transactionId}`,
                preview_url: false,
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: userPhoneNumber,
        };

        await WhatsAppBotService.sendWhatsappMessage(
            'POST',
            `${businessPhoneNumberId}/messages`,
            messagePayload
        );

        await UserService.processOfframpTransactionInDemoMode(transactionId, {
            beneficiaryId: params.beneficiaryId,
            usdAmount: cryptoAmountToDebit,
            localAmount: fiatAmountToReceive,
            tokenAddress: asset.tokenAddress,
            hotWalletAddress: hotWalletAddress,
            chainName: asset.network.toUpperCase(),
            tokenName: 'USDC',
            userWalletAddress: asset.walletAddress,
        });
    }
}

export default WhatsAppBotController;
