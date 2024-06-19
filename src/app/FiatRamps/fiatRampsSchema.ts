import { z } from 'zod';
import { type CountryCode, isValidPhoneNumber } from 'libphonenumber-js';

export const getCurrenciesResponseSchema = z.object({
    data: z.array(
        z.object({
            code: z.string(),
            country: z.string(),
            currencyName: z.string(),
            currencySymbol: z.string(),
            flag: z.string().url(),
            id: z.string(),
        })
    ),
});

export type GetCurrenciesResponse = z.infer<typeof getCurrenciesResponseSchema>;

export const getTransactionFeeResponseSchema = z.object({
    data: z.object({
        onrampFeePercentage: z.number(),
        offrampFeePercentage: z.number(),
    }),
});

export type GetTransactionFeeResponse = z.infer<typeof getTransactionFeeResponseSchema>;

export const getRateResponseSchema = z.object({
    data: z.object({
        buy: z.number(),
        sell: z.number(),
        locale: z.string(),
        code: z.string(),
    }),
});

export type GetRateResponse = z.infer<typeof getRateResponseSchema>;

export const getPaymentMethodsResponseSchema = z.object({
    data: z.object({
        channels: z.array(
            z.object({
                channelName: z.enum(['bank', 'phone']),
                channelId: z.string(),
            })
        ),
        limits: z.object({
            min: z.number(),
            max: z.number(),
        }),
    }),
});

export type GetPaymentMethodsResponse = z.infer<typeof getPaymentMethodsResponseSchema>;

export const getMobileProvidersResponseSchema = z.object({
    data: z.array(
        z.object({
            channelId: z.string(),
            networkId: z.string(),
            code: z.string(),
            name: z.string(),
        })
    ),
});

export type GetMobileProvidersResponse = z.infer<typeof getMobileProvidersResponseSchema>;

export const onrampTransactionPayloadSchema = z.object({
    country: z.string(),
    accountType: z.enum(['bank', 'phone']),
    localAmount: z.number(),
    accountNumber: z.string().optional(),
    channelId: z.string(),
    networkId: z.string().optional(),
    chainName: z.string(),
    tokenName: z.string(),
    userWalletAddress: z.string(),
});

export type OnrampTransactionPayload = z.infer<typeof onrampTransactionPayloadSchema>;

export const sendOnrampTransactionResponseSchema = z.object({
    data: z.object({
        bankInfo: z
            .object({
                accountName: z.string(),
                accountNumber: z.string(),
                name: z.string(),
            })
            .optional(),
        narration: z.string(),
        amount: z.string(),
        sequenceId: z.string(),
    }),
});

export type SendOnrampTransactionResponse = z.infer<typeof sendOnrampTransactionResponseSchema>;

export const supportedBankSchema = z.object({
    networkId: z.string().min(3),
    channelId: z.string().min(3),
    name: z.string().min(3),
    slug: z.string().min(3),
    code: z.string().min(3),
});

export type SupportedBank = z.infer<typeof supportedBankSchema>;

export const getSupportedBanksResponseSchema = z.object({
    data: z.array(supportedBankSchema),
});

export type GetSupportedBanksResponse = z.infer<typeof getSupportedBanksResponseSchema>;

export const bankBeneficiarySchema = z.object({
    accountName: z.string(),
    accountNumber: z.string(),
    bankName: z.string(),
    networkId: z.string(),
    channelId: z.string(),
    id: z.string(),
    countryId: z.string(),
});

export const mobileMoneyBeneficiarySchema = (countryCode: CountryCode) =>
    z
        .object({
            firstName: z.string(),
            lastName: z.string(),
            networkId: z.string(),
            channelId: z.string(),
            id: z.string(),
            mobileProvider: z.string(),
            mobileProviderCode: z.string(),
            mobileNumber: z.string(),
            countryId: z.string(),
        })
        .refine((data) => isValidPhoneNumber(data.mobileNumber, countryCode), {
            message: 'Invalid Mobile Number',
            path: ['mobileNumber'],
        });

export const createBeneficiaryParams = (
    beneficiaryType: 'phone' | 'bank',
    countryCode: CountryCode
) =>
    z.object({
        beneficiary:
            beneficiaryType === 'phone'
                ? mobileMoneyBeneficiarySchema(countryCode)
                : bankBeneficiarySchema,
    });

export type CreateBeneficiaryParams = z.infer<ReturnType<typeof createBeneficiaryParams>>;

export const createBeneficiaryResponseSchema = z.object({
    beneficiaryId: z.string(),
});

export type CreateBeneficiaryResponse = z.infer<typeof createBeneficiaryResponseSchema>;

export const getBeneficiariesResponseSchema = (
    countryCode: CountryCode,
    beneficiaryType: 'phone' | 'bank'
) =>
    z.object({
        data: z.array(
            beneficiaryType === 'phone'
                ? mobileMoneyBeneficiarySchema(countryCode)
                : bankBeneficiarySchema
        ),
    });

export type GetBeneficiariesResponse = z.infer<ReturnType<typeof getBeneficiariesResponseSchema>>;

export const sendOfframpRequestPayloadSchema = z.object({
    beneficiaryId: z.string(),
    localAmount: z.number(),
    chainName: z.string(),
    tokenName: z.string(),
    userWalletAddress: z.string(),
    hotWalletAddress: z.string(),
    usdAmount: z.number(),
    tokenAddress: z.string(),
    txHash: z.string(),
});

export type SendOfframpRequestPayload = z.infer<typeof sendOfframpRequestPayloadSchema>;

export const sendOfframpRequestResponseSchema = z.object({
    data: z.object({
        offrampRequestId: z.string(),
    }),
});

export type SendOfframpRequestResponse = z.infer<typeof sendOfframpRequestResponseSchema>;
