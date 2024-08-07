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
