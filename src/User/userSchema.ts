import { z } from 'zod';
import { supportedChainSchema } from '@/app/WalletKit/walletKitSchema';

export const userAssetSchema = z.object({
    listItemId: z.string(),
    walletAddress: z.string(),
    name: z.string(),
    tokenAddress: z.string(),
    network: supportedChainSchema,
});

export type UserAssetItem = z.infer<typeof userAssetSchema>;
