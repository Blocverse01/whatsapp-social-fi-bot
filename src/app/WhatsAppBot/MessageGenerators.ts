import { WhatsAppInteractiveMessage, WhatsAppMessageType } from '@/app/WhatsAppBot/WhatsAppBotType';

type GenerateInteractiveListMessageParams = {
    listItems: Array<{
        title: string;
        description: string;
        id: string;
    }>;
    bodyText: string;
    headerText: string;
    actionButtonText: string;
    recipient: string;
};

class MessageGenerators {
    public static generateInteractiveListMessage(params: GenerateInteractiveListMessageParams) {
        const { listItems, actionButtonText, bodyText, recipient, headerText } = params;

        return {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: WhatsAppMessageType.INTERACTIVE,
            interactive: {
                type: 'list',
                body: {
                    text: bodyText,
                },
                header: {
                    type: 'text',
                    text: headerText,
                },
                action: {
                    button: actionButtonText,
                    sections: [
                        {
                            rows: listItems,
                        },
                    ],
                },
            },
        } satisfies WhatsAppInteractiveMessage;
    }
}

export default MessageGenerators;
