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
    TokenBalancesResponse,
} from '@/app/WalletKit/walletKitSchema';
import {
    GET_TOKEN_BALANCES,
    GET_WALLET_BY_OWNER_ID,
    SIGN_AND_SEND_TRANSACTION,
    TRANSACTION_STATUS_BY_ID,
    TRANSFER_TOKEN,
    WALLETS,
} from '@/app/WalletKit/endpoints';
import axios from 'axios';

class WalletKitService {
    private static API_URL =
        env.WEB3_ENVIRONMENT === 'testnet'
            ? env.WALLET_KIT_API_URL
            : env.WALLET_KIT_MAINNET_API_URL;

    private static get requiredRequestHeaders() {
        const apiToken =
            env.WEB3_ENVIRONMENT === 'testnet'
                ? env.WALLET_KIT_API_TOKEN
                : env.WALLET_KIT_MAINNET_API_TOKEN;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
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

        const requestUrl = `${this.API_URL}${TRANSFER_TOKEN}`;

        const response = await axios.post<TransactionResponse>(requestUrl, validatedParams, {
            headers: this.requiredRequestHeaders,
        });

        return response.data;
    }

    public static async getTransactionById(transactionId: string) {
        const requestQueryParams = new URLSearchParams({
            id: transactionId,
        });
        const requestUrl = `${this.API_URL}${TRANSACTION_STATUS_BY_ID}?${requestQueryParams.toString()}`;

        const response = await axios.get<TransactionResponse>(requestUrl, {
            headers: this.requiredRequestHeaders,
        });

        return response.data;
    }

    public static async waitForTransactionHashAndStatus(transactionId: string) {
        let transaction = await this.getTransactionById(transactionId);

        while (transaction.status === 'submitted' && !transaction.transaction_hash) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            transaction = await this.getTransactionById(transactionId);
        }

        return transaction as TransactionResponse & { transaction_hash: string };
    }

    public static async getBalance(
        walletAddress: string,
        network: SupportedChain,
        contractAddress: string
    ) {
        const requestQueryParams = new URLSearchParams({
            wallet_address: walletAddress,
            network,
        });

        const requestUrl = `${this.API_URL}${GET_TOKEN_BALANCES}?${requestQueryParams.toString()}`;

        const response = await axios.get<TokenBalancesResponse>(requestUrl, {
            headers: this.requiredRequestHeaders,
        });

        const tokenBalances = response.data;

        const tokenBalance = tokenBalances.find(
            (tokenBalance) =>
                tokenBalance.contract_address.toLowerCase() === contractAddress.toLowerCase()
        );

        return tokenBalance?.display_balance ?? '0';
    }
}

export default WalletKitService;
