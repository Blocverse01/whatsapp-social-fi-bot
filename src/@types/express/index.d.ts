import { Request } from 'express';
import { DecryptedFlowDataExchange } from '@/app/WhatsAppBot/WhatsAppBotType';

declare global {
    namespace Express {
        export interface Request {
            rawBody: string;
            decryptedFlowDataExchange?: DecryptedFlowDataExchange;
        }
    }
    export type RequestWithBody<B> = Request<Request['params'], Request['res'], B>;
    export type RequestWithParams<P> = Request<P, Request['res'], Request['body']>;
    export type RequestWithQuery<Q> = Request<
        Request['params'],
        Request['res'],
        Request['body'],
        Q
    >;
}
