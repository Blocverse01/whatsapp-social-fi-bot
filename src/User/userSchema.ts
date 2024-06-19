import { z } from 'zod';

export const userAssetSchema = z.object({
    listItemId: z.string(),
    walletAddress: z.string(),
    name: z.string(),
    tokenAddress: z.string().optional(),
});

export type UserAssetItem = z.infer<typeof userAssetSchema>;
