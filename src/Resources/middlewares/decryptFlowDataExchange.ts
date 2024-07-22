import { NextFunction, Response, Request } from 'express';
import WhatsAppBotService from '@/app/WhatsAppBot/WhatsAppBotService';
import logger from '@/Resources/logger';
import { handleRequestError } from '@/Resources/requestHelpers/handleRequestError';

const decryptFlowDataExchange = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.body) {
        return res.status(400).send('Invalid request');
    }

    logger.info('Received Flow Request', req.body);

    let decryptedRequest = null;
    try {
        decryptedRequest = WhatsAppBotService.decryptFlowRequest(req.body);
    } catch (err) {
        return handleRequestError(err, res);
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;

    logger.info('💬 Decrypted Flow Request:', decryptedBody);

    req.decryptedFlowDataExchange = {
        decryptedBody,
        aesKeyBuffer,
        initialVectorBuffer,
    };

    // Handle health pings and error reporting
    let earlyResponse: string | undefined;

    if (req.decryptedFlowDataExchange.decryptedBody.action === 'ping') {
        logger.info('Ping received');

        earlyResponse = WhatsAppBotService.encryptFlowResponse(
            {
                version: req.decryptedFlowDataExchange.decryptedBody.version,
                data: {
                    status: 'active',
                },
            },
            {
                aesKeyBuffer,
                initialVectorBuffer,
            }
        );
    }

    if (req.decryptedFlowDataExchange.decryptedBody.data?.error) {
        logger.warn('Received client error:', {
            errorData: req.decryptedFlowDataExchange.decryptedBody.data,
        });

        earlyResponse = WhatsAppBotService.encryptFlowResponse(
            {
                version: req.decryptedFlowDataExchange.decryptedBody.version,
                data: {
                    acknowledged: true,
                },
            },
            {
                aesKeyBuffer,
                initialVectorBuffer,
            }
        );
    }

    if (earlyResponse) {
        return res.send(earlyResponse);
    }

    next();
};

export default decryptFlowDataExchange;
