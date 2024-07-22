import { assetIds } from '@/app/WhatsAppBot/WhatsAppBotType';

export const SELL_BENEFICIARY_AMOUNT_PATTERN =
    /sell:(?<sell>[^|]+)\|beneficiaryId:(?<beneficiaryId>[^|]+)\|amount:(?<amount>\d+)/;

export const SELL_ASSET_TO_BENEFICIARY_REGEX_PATTERN = `^(${assetIds})|beneficiaryId:(\\w+)$`;
