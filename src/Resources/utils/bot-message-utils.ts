import { formatNumberAsCurrency } from '@/Resources/utils/currency';

type BankInfo = {
    bankName: string;
    accountName: string;
    accountNumber: string;
};

export function generateOnrampTransactionInitiatedMessage(params: {
    tokenAmount: string;
    assetName: string;
    assetNetwork: string;
    fiatToPay: string;
    bankInfo: BankInfo;
    localCurrency: string;
}): string {
    const { tokenAmount, assetName, assetNetwork, fiatToPay, localCurrency, bankInfo } = params;

    const fiatToPayFormatted = formatNumberAsCurrency(parseFloat(fiatToPay), localCurrency);

    return `🔔 New transaction initiated.\n\n🧾 *Summary*:\nBuy ${tokenAmount} ${assetName} on ${assetNetwork} with ${fiatToPayFormatted}\n\n-------------------------------------------------------\n💳 *Payment Details*.\n-------------------------------------------------------\n\n*\`Account Number\`* ${bankInfo.accountNumber}\n\n*\`Account Name\`* ${bankInfo.accountName}\n\n*\`Bank Name\`* ${bankInfo.bankName}\n\n*\`Amount\`* ${fiatToPayFormatted}\n\n-------------------------------------------------------\n_After payment, we'll send you updates on your transaction's status._\n-------------------------------------------------------`;
}

export function generateOnrampTransactionInitiatedWithMomoPaymentMessage(params: {
    tokenAmount: string;
    assetName: string;
    assetNetwork: string;
    fiatToPay: string;
    localCurrency: string;
    momoDetails: BankInfo;
}): string {
    const { tokenAmount, assetName, assetNetwork, fiatToPay, localCurrency, momoDetails } = params;

    const fiatToPayFormatted = formatNumberAsCurrency(parseFloat(fiatToPay), localCurrency);

    return `🔔 New transaction initiated.\n\n🧾 *Summary*:\nBuy ${tokenAmount} ${assetName} on ${assetNetwork} with ${fiatToPayFormatted}\n\n-------------------------------------------------------\n💳 *MoMo Details*.\n-------------------------------------------------------\n\n*\`Phone Number\`* ${momoDetails.accountNumber}\n\n*\`Full Name\`* ${momoDetails.accountName}\n\n*\`Mobile Provider\`* ${momoDetails.bankName}\n\n*\`Amount\`* ${fiatToPayFormatted}\n\n-------------------------------------------------------\n_Please follow the instructions on your phone to complete the transaction._\n-------------------------------------------------------`;
}

export function generateOfframpProcessingMessage(params: {
    tokenAmount: string;
    assetName: string;
    assetNetwork: string;
    localCurrency: string;
}): string {
    const { tokenAmount, assetName, assetNetwork, localCurrency } = params;

    return `🔔 New transaction initiated.\n\n🧾 *Summary*:\nSell ${tokenAmount} ${assetName} on ${assetNetwork} for ${localCurrency}\n\n-------------------------------------------------------\n_Your transaction has been created, we'll send you updates on your transaction's status._\n-------------------------------------------------------`;
}
