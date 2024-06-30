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

export const userAssetInfoSchema = z.object({
    usdDisplayBalance: z.string(),
    tokenBalance: z.string(),
    walletAddress: z.string(),
    listItemId: z.string(),
    assetName: z.string(),
    assetNetwork: z.string(),
});

export type UserAssetInfo = z.infer<typeof userAssetInfoSchema>;

export const kycStatus = z.enum(['verified', 'in_review', 'unverified', 'rejected', 'pending']);

export type KycStatus = z.infer<typeof kycStatus>;
