import { createRequestOptions } from '@/Resources/HttpRequest';
import { WhatsAppInteractiveMessage } from './WhatsAppBotType';
import axios, { isAxiosError } from 'axios';
import env from '@/constants/env';
import { INTERNAL_SERVER_ERROR } from '@/constants/status-codes';
import { HttpException } from '@/Resources/exceptions/HttpException';
import UserService from '@/User/UserService';
import logger from '@/Resources/logger';

class WhatsAppBotService {
    public static async sendWhatsappMessage(method: string, endpoint: string, data: object) {
        try {
            const requestOptions = createRequestOptions(method, endpoint, data);
            const response = await axios.post(
                `${env.CLOUD_API_URL}/${endpoint}`,
                data,
                requestOptions
            );

            logger.info('Message sent successfully');
        } catch (error) {
            let message = 'Failed to send message';

            if (isAxiosError(error)) {
                logger.error('Error sending message', { error: error });
                message = error.response?.data?.message;
            }

            throw new HttpException(INTERNAL_SERVER_ERROR, message);
        }
    }

    public static async listWalletAddressMessage(
        businessPhoneNumberId: string,
        displayName: string,
        recipient: string,
        walletsAsset: any
    ) {
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: `
                        🎉 Congrats ${displayName}, welcome aboard! 🎉
                        We've made decentralized wallets for you. It's like opening a digital piggy bank! 🐷💰
                    `,
                },
                action: {
                    buttons: walletsAsset.map((asset: { listItemId: string; name: string }) => [
                        {
                            type: 'reply',
                            reply: {
                                id: asset?.listItemId,
                                title: asset?.name,
                            },
                        },
                    ]),
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };
        await this.sendWhatsappMessage(method, endpoint, interactiveMessage);
    }

    public static async walletDetailsMessage(
        businessPhoneNumberId: string,
        displayName: string,
        recipient: string
    ) {
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: `
                        USDT(BASE) Balance 💰: $365 Wallet Address: 
                    `,
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'create-wallet',
                                title: "Let's go 🚀",
                            },
                        },
                    ],
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };
        await this.sendWhatsappMessage(method, endpoint, interactiveMessage);
    }

    public static async createWalletMessage(
        businessPhoneNumberId: string,
        displayName: string,
        recipient: string
    ) {
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const interactiveMessage: WhatsAppInteractiveMessage = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: `Hi ${displayName}! Ready to get started? Let us create a wallet for you.`,
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'create-wallet',
                                title: "Let's go 🚀",
                            },
                        },
                    ],
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
        };
        await this.sendWhatsappMessage(method, endpoint, interactiveMessage);
    }

    public static async markMassageAsRead(businessPhoneNumberId: string, messageId: string) {
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const data = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId, // Replace with the actual message ID
        };

        // Create request options with error handling (assuming createRequestOptions doesn't handle errors)
        try {
            const requestOptions = createRequestOptions(method, endpoint, data);
            const response = await axios.post(
                `${env.CLOUD_API_URL}/${endpoint}`,
                data,
                requestOptions
            );
            console.log('Message marked as read successfully:', response.data); // Handle successful response (optional)
        } catch (error) {
            console.error('Error marking message as read:', error); // Handle errors
        }
    }

    async walletCreationConfirmationMassage() {}

    public static async isMessageProcessed(messageId: string) {
        try {
            const data = await UserService.getUserByMessageId(messageId);
            return !!data;
        } catch (error) {
            console.error('Error checking processed messages:', error);
        }
    }

    // Function to mark message as processed
    public static async markMessageProcessed(messageId: string): Promise<void> {
        try {
            const data = await UserService.markMessageProcessed(messageId);
        } catch (error) {
            console.error('Error marking message as processed:', error);
        }
    }
}

export default WhatsAppBotService;
