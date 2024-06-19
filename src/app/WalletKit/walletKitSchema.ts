import { z } from 'zod';
import { isAddress, isHex } from 'viem';

export const SUPPORTED_CHAINS = ['Polygon', 'Base', 'Ethereum'] as const;
export const supportedChainSchema = z.enum(SUPPORTED_CHAINS);
export type SupportedChain = z.infer<typeof supportedChainSchema>;

export const walletControlMode = z.enum(['developer', 'user']);

export const createWalletKitWalletParams = z.object({
    name: z.string(),
    network: supportedChainSchema,
    owner_id: z.string(),
    control_mode: walletControlMode,
    developer_secret: z.string(),
    type: z.enum(['eoa', 'contract']),
});

export type CreateWalletKitWalletParams = z.infer<typeof createWalletKitWalletParams>;

export const createWalletKitWalletResponse = z.object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    network: supportedChainSchema,
    owner_id: z.string(),
    control_mode: walletControlMode,
    type: z.string(),
});

export type CreateWalletKitWalletResponse = z.infer<typeof createWalletKitWalletResponse>;

export const walletAddressSchema = (name: string) =>
    z.string().refine((data) => isAddress(data), `${name} should be a valid address`);
export const hexStringSchema = (name: string) =>
    z.string().refine((data) => isHex(data), `${name} should be a hex string`);

export const signAndSendTransactionSchema = z.object({
    network: supportedChainSchema,
    signer_wallet_address: walletAddressSchema('signer_wallet_address'),
    unsigned_transaction: z.object({
        to: walletAddressSchema('signer_wallet_address'),
        input: hexStringSchema('input').optional(),
        value: hexStringSchema('value').optional(),
    }),
    developer_secret: z.string(),
});

export type SignAndSendTransactionParams = z.infer<typeof signAndSendTransactionSchema>;

export const transactionResponse = z.object({
    transaction_id: z.string(),
    network: supportedChainSchema,
    status: z.enum(['success', 'submitted', 'failed']),
    contract_address: z.string().nullable(),
    explorer_url: z.string().url().nullable(),
    transaction_hash: z.string().nullable(),
});

export type TransactionResponse = z.infer<typeof transactionResponse>;

export const transferTokenParams = z.object({
    network: supportedChainSchema,
    from: z.string(),
    token: z.string(),
    recipient: z.string(),
    amount: z.string(),
    developer_secret: z.string(),
});

export type TransferTokenParams = z.infer<typeof transferTokenParams>;