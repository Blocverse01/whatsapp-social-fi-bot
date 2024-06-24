import { z } from 'zod';
import { supportedChainSchema } from '@/app/WalletKit/walletKitSchema';
import { bankBeneficiarySchema } from '@/app/FiatRamp/fiatRampSchema';

export const userAssetSchema = z.object({
    listItemId: z.string(),
    walletAddress: z.string(),
    name: z.string(),
    tokenAddress: z.string(),
    network: supportedChainSchema,
});

export type UserAssetItem = z.infer<typeof userAssetSchema>;


// interface BankBeneficiary {
//     accountName: string;
//     accountNumber: string;
//     bankName: string;
//     networkId: string;
//     channelId: string;
//     id: string;
//     countryId: string;
// }

// interface MobileBeneficiary {
//     networkId: string;
//     channelId: string;
//     id: string;
//     countryId: string;
//     mobileNumber: string;
// }

// type Beneficiary = MobileBeneficiary | BankBeneficiary;
// export type UsersBeneficiaries = Beneficiary[];


export const userAssetInfoSchema = z.object({
    usdDisplayBalance: z.number(),
    tokenBalance: z.string(),
    walletAddress: z.string(),
    listItemId : z.string()
}) 
