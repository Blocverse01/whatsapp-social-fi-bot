import { z } from 'zod';

export enum WebhookPayloadDigestAlgorithms {
    HMAC_SHA1_HEX = 'sha1',
    HMAC_SHA256_HEX = 'sha256',
    HMAC_SHA512_HEX = 'sha512',
}

type WebhookPayloadDigestAlgorithmsKeys = keyof typeof WebhookPayloadDigestAlgorithms;

export const webhookPayloadDigestSchema = z.object({
    payload: z.string(),
    payloadDigestAlgorithm: z.custom<WebhookPayloadDigestAlgorithmsKeys>(),
    payloadDigest: z.string(),
});

export type WebhookPayloadDigestConfig = z.infer<typeof webhookPayloadDigestSchema>;
