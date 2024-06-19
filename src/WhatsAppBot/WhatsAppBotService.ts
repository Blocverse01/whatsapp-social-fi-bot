
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

    // getWhatsAppMessage(
    //     type: WhatsAppMessageType,
    //     recipient: string,
    //     content: string | string[] | WhatsAppInteractiveMessage
    // ) {
    //     switch (type) {
    //         case WhatsAppMessageType.TEXT:
    //         return {
    //             messaging_product: 'whatsapp',
    //             recipient_type: 'individual',
    //             to: recipient,
    //             type: type,
    //             text: {
    //             preview_url: false,
    //             body: content as string, 
    //             },
    //         };
    //         case WhatsAppMessageType.STICKER:
    //         return {
    //             messaging_product: 'whatsapp',
    //             recipient_type: 'individual',
    //             to: recipient,
    //             type: type,
    //             sticker: {
    //             id: content as string,
    //             },
    //         };
    //         case WhatsAppMessageType.INTERACTIVE:
    //         return {
    //             messaging_product: 'whatsapp',
    //             recipient_type: 'individual',
    //             to: recipient,
    //             type: type,
    //             interactive: content as WhatsAppInteractiveMessage,
    //         };
    //         default:
    //         throw new Error('Unsupported WhatsApp message type');
    //     }
    // }

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

    async walletCreationConfirmationMassage() {
        
    }
}

export default WhatsAppBotService;