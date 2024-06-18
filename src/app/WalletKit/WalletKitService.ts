import env from '@/constants/env';
import {
    createWalletKitWalletParams,
    CreateWalletKitWalletParams,
    CreateWalletKitWalletResponse,
    SignAndSendTransactionParams,
    TransactionResponse,
    signAndSendTransactionSchema,
    SUPPORTED_CHAINS,
    SupportedChain,
    transferTokenParams,
    TransferTokenParams,
} from '@/app/WalletKit/walletKitSchema';
import {
    GET_WALLET_BY_OWNER_ID,
    SIGN_AND_SEND_TRANSACTION,
    TRANSACTION_STATUS_BY_ID,
    TRANSFER_TOKEN,
    WALLETS,
} from '@/app/WalletKit/endpoints';
import axios from 'axios';

class WalletKitService {
    private static API_URL = env.WALLET_KIT_API_URL;

    private static get requiredRequestHeaders() {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.WALLET_KIT_API_TOKEN}`,
            'X-WalletKit-Project-ID': env.WALLET_KIT_PROJECT_ID,
        };
    }

    public static async createUserWallet(params: CreateWalletKitWalletParams) {
        const validatedParams = createWalletKitWalletParams.parse(params);
        const requestUrl = this.API_URL + WALLETS;

        const response = await axios.post<CreateWalletKitWalletResponse>(
            requestUrl,
            validatedParams,
            {
                headers: this.requiredRequestHeaders,
            }
        );

        return response.data;
    }

    public static async getUserWalletByNetwork(ownerId: string, network: SupportedChain) {
        const requestQueryParams = new URLSearchParams({
            ownerID: ownerId,
            network,
        });
        const requestUrl = `${this.API_URL}${GET_WALLET_BY_OWNER_ID}?${requestQueryParams.toString()}`;

        const response = await axios.get<CreateWalletKitWalletResponse>(requestUrl, {
            headers: this.requiredRequestHeaders,
        });

        return response.data;
    }

    public static async getUserWallets(ownerId: string) {
        const promises = SUPPORTED_CHAINS.map((network) =>
            this.getUserWalletByNetwork(ownerId, network)
        );

        const settlements = await Promise.allSettled(promises);

        const fulfilledSettlements = settlements.filter(
            (settlement) => settlement.status === 'fulfilled'
        ) as Array<PromiseFulfilledResult<CreateWalletKitWalletResponse>>;

        return fulfilledSettlements
            .filter((settlement) => settlement.status === 'fulfilled')
            .map((settlement) => settlement.value);
    }

    public static async signAndSendTransaction(params: SignAndSendTransactionParams) {
        const validatedParams = signAndSendTransactionSchema.parse(params);
        const requestUrl = this.API_URL + SIGN_AND_SEND_TRANSACTION;

        const response = await axios.post<TransactionResponse>(requestUrl, validatedParams, {
            headers: this.requiredRequestHeaders,
        });

        return response.data;
    }

    public static async transferToken(params: TransferTokenParams) {
        const validatedParams = transferTokenParams.parse(params);

        const response = await axios.post<TransactionResponse>(TRANSFER_TOKEN, validatedParams, {
            headers: this.requiredRequestHeaders,
        });

        return response.data;
    }

    public static async getTransactionStatusById(transactionId: string) {
        const requestQueryParams = new URLSearchParams({
            id: transactionId,
        });
        const requestUrl = `${this.API_URL}${TRANSACTION_STATUS_BY_ID}?${requestQueryParams.toString()}`;

        const response = await axios.get<TransactionResponse>(requestUrl, {
            headers: this.requiredRequestHeaders,
        });

        return response.data;
    }
}

export default WalletKitService;
