import { SendOfframpRequestPayload } from '@/app/FiatRamp/fiatRampSchema';
import FiatRampService from '@/app/FiatRamp/FiatRampService';
import { logServiceError } from '@/Resources/requestHelpers/handleRequestError';
import WalletKitService from '@/app/WalletKit/WalletKitService';
import logger from '@/Resources/logger';

export type ProcessOfframpInBackgroundParams = Omit<SendOfframpRequestPayload, 'txHash'> & {
    onChainTransactionId: string;
};

const offrampParams: ProcessOfframpInBackgroundParams = JSON.parse(process.argv[2]);

async function processInBackground(txParams: ProcessOfframpInBackgroundParams) {
    const { onChainTransactionId } = txParams;

    try {
        const transactionDetails = await WalletKitService.getTransactionById(onChainTransactionId);

        logger.debug('Running process in background', {
            transactionDetails,
        });

        if (transactionDetails.status === 'submitted') {
            setTimeout(() => {
                processInBackground(txParams);
            }, 5000);
        }

        if (transactionDetails.status === 'success' && transactionDetails.transaction_hash) {
            try {
                logger.info('Processing offramp', {
                    onChainTransactionId,
                });

                const sequenceId = await FiatRampService.postOfframpTransaction({
                    ...txParams,
                    txHash: transactionDetails.transaction_hash,
                    chainName: txParams.chainName.toUpperCase(),
                    tokenName: txParams.tokenName.toUpperCase(),
                });

                await logger.info('Offramp transaction processed successfully', { sequenceId });
            } catch (error) {
                await logServiceError(error, 'Sending offramp transaction failed');
            }
        }
    } catch (error) {
        await logServiceError(error, 'Background process failed:');
    }
}

processInBackground(offrampParams);
