import env from '@/constants/env';
import axios from 'axios';
import {
    CREATE_BENEFICIARY,
    GET_BANKS,
    GET_BENEFICIARIES,
    GET_MOBILE_PROVIDERS,
    GET_PAYMENT_CHANNELS,
    GET_RATES,
    GET_SUPPORTED_CURRENCIES,
    GET_TRANSACTION_FEE,
    POST_ONRAMP,
    SEND_OFFRAMP_REQUEST,
} from '@/app/FiatRamps/endpoints';
import {
    createBeneficiaryParams,
    CreateBeneficiaryParams,
    CreateBeneficiaryResponse,
    GetBeneficiariesResponse,
    GetCurrenciesResponse,
    GetMobileProvidersResponse,
    GetPaymentMethodsResponse,
    GetRateResponse,
    GetSupportedBanksResponse,
    GetTransactionFeeResponse,
    OnrampTransactionPayload,
    SendOfframpRequestPayload,
    sendOfframpRequestPayloadSchema,
    SendOfframpRequestResponse,
    SendOnrampTransactionResponse,
} from '@/app/FiatRamps/fiatRampsSchema';
import { HUNDRED } from '@/constants/numbers';
import { CountryCode } from 'libphonenumber-js';

class FiatRampService {
    private static API_URL = env.FIAT_RAMPS_PROVIDER_API_URL;

    public static get requiredRequestHeaders() {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.FIAT_RAMPS_PROVIDER_API_KEY}`,
            'X-FiatRamps-Project-ID': env.FIAT_RAMPS_PROVIDER_PROJECT_ID,
        };
    }

    public static async getSupportedCurrencies() {
        const requestUrl = this.API_URL + GET_SUPPORTED_CURRENCIES;

        const response = await axios.get<GetCurrenciesResponse>(requestUrl, {
            headers: this.requiredRequestHeaders,
        });

        return response.data.data;
    }

    public static async getTransactionFee(countryCode: CountryCode, route: 'onramp' | 'offramp') {
        const requestUrl = `${this.API_URL}${GET_TRANSACTION_FEE}?country=${countryCode}`;

        const response = await axios.get<GetTransactionFeeResponse>(requestUrl, {
            headers: this.requiredRequestHeaders,
        });

        const fees = response.data.data;

        if (route === 'onramp') {
            return fees.onrampFeePercentage / HUNDRED;
        }

        return fees.offrampFeePercentage / HUNDRED;
    }

    public static async getRates(currencySymbol: string, route: 'onramp' | 'offramp') {
        const requestUrl = `${this.API_URL}${GET_RATES}?currency=${currencySymbol}`;

        const response = await axios.get<GetRateResponse>(requestUrl, {
            headers: this.requiredRequestHeaders,
        });

        return route === 'onramp' ? response.data.data.buy : response.data.data.sell;
    }

    public static async getQuotes(
        currencySymbol: string,
        countryCode: CountryCode,
        route: 'onramp' | 'offramp'
    ) {
        const rate = await this.getRates(currencySymbol, route);
        const fee = await this.getTransactionFee(countryCode, route);

        return {
            rate,
            fee,
        };
    }

    public static async getPaymentMethods(countryCode: CountryCode, route: 'onramp' | 'offramp') {
        const rampType = route === 'onramp' ? 'deposit' : 'withdraw';
        const requestUrl = `${this.API_URL}${GET_PAYMENT_CHANNELS}?country=${countryCode}&rampType=${rampType}`;

        const response = await axios.get<GetPaymentMethodsResponse>(requestUrl, {
            headers: this.requiredRequestHeaders,
        });

        const limits = response.data.data.limits;

        return {
            paymentChannels: response.data.data.channels,
            countryFiatLimits: limits,
        };
    }

    public static formatPaymentMethodName(channelName: string, route: 'onramp' | 'offramp') {
        if (route === 'onramp') {
            return channelName === 'bank' ? 'bank transfer' : 'mobile money';
        }
        return channelName === 'bank' ? 'bank account' : 'mobile money account';
    }

    public static async getSupportedMobileProviders(channelId: string) {
        const response = await axios.get<GetMobileProvidersResponse>(
            `${GET_MOBILE_PROVIDERS}?channelId=${channelId}`,
            {
                headers: this.requiredRequestHeaders,
            }
        );

        return response.data.data;
    }

    public static async postOnrampTransaction(transactionPayload: OnrampTransactionPayload) {
        const response = await axios.post<SendOnrampTransactionResponse>(
            POST_ONRAMP,
            transactionPayload,
            {
                headers: this.requiredRequestHeaders,
            }
        );

        const responseData = response.data.data;

        return {
            ...responseData,
            bankInfo: responseData.bankInfo
                ? {
                      accountName: responseData.bankInfo.accountName,
                      accountNumber: responseData.bankInfo.accountNumber,
                      bankName: responseData.bankInfo.name,
                  }
                : undefined,
        };
    }

    public static async getSupportedBanks() {
        const response = await axios.get<GetSupportedBanksResponse>(GET_BANKS, {
            headers: this.requiredRequestHeaders,
        });

        return response.data.data;
    }

    public static async createBeneficiary(
        ownerId: string,
        countryCode: CountryCode,
        accountType: 'bank' | 'phone',
        params: CreateBeneficiaryParams
    ) {
        const requestUrl = `${this.API_URL}${CREATE_BENEFICIARY}`;
        const validatedParams = createBeneficiaryParams(accountType, countryCode).parse(params);

        const {
            beneficiary: { countryId, ...other },
        } = validatedParams;

        const response = await axios.post<CreateBeneficiaryResponse>(requestUrl, {
            ownerId,
            accountType,
            beneficiary: other,
            countryId: countryId,
        });

        return response.data.beneficiaryId;
    }

    public static async getBeneficiaries(
        ownerId: string,
        countryCode: CountryCode,
        accountType: 'bank' | 'phone'
    ) {
        const requestQueryParams = new URLSearchParams({
            ownerId,
            accountType,
            country: countryCode,
        });

        const requestUrl = `${this.API_URL}${GET_BENEFICIARIES}?${requestQueryParams.toString()}`;

        const response = await axios.get<GetBeneficiariesResponse>(requestUrl, {
            headers: this.requiredRequestHeaders,
        });

        return response.data.data;
    }

    public static async sendOfframpRequest(params: SendOfframpRequestPayload) {
        const requestUrl = `${this.API_URL}${SEND_OFFRAMP_REQUEST}`;
        const validatedParams = sendOfframpRequestPayloadSchema.parse(params);

        const response = await axios.post<SendOfframpRequestResponse>(requestUrl, validatedParams, {
            headers: this.requiredRequestHeaders,
        });

        return response.data.data.offrampRequestId;
    }
}

export default FiatRampService;
