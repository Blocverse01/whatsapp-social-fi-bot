
import { createRequestOptions } from '@/Resources/HttpRequest';
import {
    WhatsAppInteractiveMessage
} from './WhatsAppBotType'
import axios, { isAxiosError } from 'axios';
import env from '@/constants/env';
import { INTERNAL_SERVER_ERROR } from '@/constants/status-codes';
import { HttpException } from '@/Resources/exceptions/HttpException';

class WhatsAppBotService{
    public static async sendWhatsappMessage(method:string ,endpoint:string, data: object) {
        try {
            const requestOptions = createRequestOptions(method, endpoint, data);
             const response = await axios.post(
                `${env.CLOUD_API_URL}/${endpoint}`,
                data,
                requestOptions
            );
            console.log("Message sent successfully");
        } catch (error) {
            let message = 'Failed to send message';

            if(isAxiosError(error)) {
                console.log({errorResponse: error.response});
                message = error.response?.data?.message;
            }

            throw new HttpException(INTERNAL_SERVER_ERROR, message);
        }
    }

    public static async createWalletMessage(businessPhoneNumberId:string, displayName: string, recipient: string) {
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
                                title: 'Yes',
                            },
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'dont-create-wallet',
                                title: 'No',
                            },
                        },
                    ],
                },
            },
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient
        };
        await this.sendWhatsappMessage(method,endpoint,interactiveMessage);
    }

   public static async markMassageAsRead(businessPhoneNumberId: string, messageId : string) {
        const method = 'POST';
        const endpoint = `${businessPhoneNumberId}/messages`;
        const data = {
            messaging_product: "whatsapp",
            status: "read",
            message_id: messageId, // Replace with the actual message ID
        };

        // Create request options with error handling (assuming createRequestOptions doesn't handle errors)
        try {
            const requestOptions = createRequestOptions(method, endpoint, data);
             const response = await axios.post(
                `${env.CLOUD_API_URL}${endpoint}`,
                data,
                requestOptions
            );
            console.log("Message marked as read successfully:", response.data); // Handle successful response (optional)
        } catch (error) {
            console.error("Error marking message as read:", error); // Handle errors
        }
    }

    async walletCreationConfirmationMassage() {
        
    }
}

export default WhatsAppBotService;