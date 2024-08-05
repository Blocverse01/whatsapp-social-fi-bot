import WalletKitService from '@/app/WalletKit/WalletKitService';
import { logServiceError } from '@/Resources/requestHelpers/handleRequestError';
import MessageGenerators from '@/app/WhatsAppBot/MessageGenerators';
import WhatsAppBotService from '@/app/WhatsAppBot/WhatsAppBotService';
import env from '@/constants/env';
import { HttpException } from '@/Resources/exceptions/HttpException';

type WaitForTransactionReceiptInBackgroundParams = {
    transactionId: string;
    userId: string;
    destination: string;
};

const transactionParams: WaitForTransactionReceiptInBackgroundParams = JSON.parse(process.argv[2]);

async function processInBackground(params: WaitForTransactionReceiptInBackgroundParams) {
    const { transactionId, userId } = params;

    try {
        const transactionDetails = await WalletKitService.getTransactionById(transactionId);

        if (transactionDetails.status === 'submitted' || transactionDetails.status === 'pending') {
            setTimeout(() => {
                processInBackground(params);
            }, 5000);
        }

        if (transactionDetails.status === 'success' && transactionDetails.transaction_hash) {
            const message = MessageGenerators.generateTextMessage(
                userId,
                `Your Transaction with the following details has been successfully processed: \n\nTransaction ID: ${transactionId}\nTransaction Hash: ${transactionDetails.transaction_hash}\nTransaction Type: Transfer to Wallet\nDestination: ${params.destination}\n\nView In Explorer: ${transactionDetails.explorer_url}`
            );

            await WhatsAppBotService.sendWhatsappMessage(env.WA_PHONE_NUMBER_ID, message);
        }

        if (transactionDetails.status === 'failed') {
            const message = MessageGenerators.generateTextMessage(
                userId,
                `Your Transaction with the following details has failed: \n\nTransaction ID: ${transactionId}\nTransaction Type: Transfer to Wallet\nDestination: ${params.destination}\n\nPlease try again later or contact support for assistance.`
            );

            await WhatsAppBotService.sendWhatsappMessage(env.WA_PHONE_NUMBER_ID, message);

            await logServiceError(
                new HttpException(500, 'Transaction failed', {
                    transactionDetails,
                    params,
                }),
                'Transaction failed:'
            );
        }
    } catch (error) {
        await logServiceError(error, 'Waiting for transaction receipt in background failed:');
    }
}

processInBackground(transactionParams);
