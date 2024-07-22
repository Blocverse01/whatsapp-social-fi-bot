export const SELL_BENEFICIARY_AMOUNT_PATTERN =
    /sell:(?<sell>[^|]+)\|beneficiaryId:(?<beneficiaryId>[^|]+)\|amount:(?<amount>\d+)/;

export const SELL_ASSET_TO_BENEFICIARY_REGEX_PATTERN =
    /sell:(?<sell>[^|]+)\|beneficiaryId:(?<beneficiaryId>[^|]+)/;

export type SellAssetToBeneficiaryMatchGroups = {
    sell: string;
    beneficiaryId: string;
};

export const extractSellAssetToBeneficiaryGroups = (
    text: string
): SellAssetToBeneficiaryMatchGroups => {
    const match = text.match(SELL_ASSET_TO_BENEFICIARY_REGEX_PATTERN);

    if (!match) {
        throw new Error('Invalid sell asset to beneficiary command');
    }

    return match.groups as SellAssetToBeneficiaryMatchGroups;
};
