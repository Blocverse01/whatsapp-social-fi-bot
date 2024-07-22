export const SELL_BENEFICIARY_AMOUNT_PATTERN =
    /sell:(?<sell>[^|]+)\|beneficiaryId:(?<beneficiaryId>[^|]+)\|amount:(?<amount>\d+)/;

export const SELL_ASSET_TO_BENEFICIARY_REGEX_PATTERN =
    /sell:(?<sell>[^|]+)\|beneficiaryId:(?<beneficiaryId>[^|]+)/;

// create a regex pattern from `sellAssetToBeneficiary:${assetId}|beneficiaryAction:chooseExisting`
export const SELL_ASSET_DESTINATION_CHOICE_REGEX =
    /sell:(?<assetId>[^|]+)\|beneficiaryAction:(?<action>[^|]+)/;

export type SellAssetToBeneficiaryMatchGroups = {
    sell: string;
    beneficiaryId: string;
};

export type SellAssetDestinationChoiceMatchGroups = {
    sell: string;
    beneficiaryAction: 'chooseExisting' | 'addNew';
};

// generic function for extracting any regex groups, with a type parameter
export const extractGroups = <T extends Record<string, string>>(text: string, regex: RegExp): T => {
    const match = text.match(regex);

    if (!match) {
        throw new Error('Invalid command');
    }

    return match.groups as T;
};

export const extractSellAssetDestinationChoiceGroups = (text: string) => {
    return extractGroups<SellAssetDestinationChoiceMatchGroups>(
        text,
        SELL_ASSET_DESTINATION_CHOICE_REGEX
    );
};

export const extractSellAssetToBeneficiaryGroups = (
    text: string
): SellAssetToBeneficiaryMatchGroups => {
    return extractGroups<SellAssetToBeneficiaryMatchGroups>(
        text,
        SELL_ASSET_TO_BENEFICIARY_REGEX_PATTERN
    );
};
