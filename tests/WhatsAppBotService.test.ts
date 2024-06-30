import WhatsAppBotService from '@/app/WhatsAppBot/WhatsAppBotService';
import {
    AssetInteractiveButtonIds,
    ExploreAssetActions,
    MORE_CURRENCIES_COMMAND_REGEX,
    MORE_CURRENCIES_COMMAND_REGEX_PATTERN,
} from '@/app/WhatsAppBot/WhatsAppBotType';
import { TEN_THOUSAND } from '@/constants/numbers';

describe('WhatsAppBotService', () => {
    it(
        'can send supported countries message',
        async () => {
            await WhatsAppBotService.sendSelectSupportedCurrenciesMessage(
                {
                    userPhoneNumber: '2348143100808',
                    businessPhoneNumberId: process.env.WA_PHONE_NUMBER_ID!,
                },
                ExploreAssetActions.BUY_ASSET,
                AssetInteractiveButtonIds.USDC_BASE
            );
        },
        TEN_THOUSAND * 3
    );

    it(
        'can send paginated supported currencies message',
        async () => {
            const assetActionId = ExploreAssetActions.BUY_ASSET;
            const purchaseAssetId = AssetInteractiveButtonIds.USDC_BASE;
            const nextSliceFrom = 9;
            const nextSliceTo = 18;

            const moreId = `moreCurrencies|${assetActionId}:${purchaseAssetId}|nextSliceFrom:${nextSliceFrom}|nextSliceTo:${nextSliceTo}`;

            expect(moreId).toMatch(MORE_CURRENCIES_COMMAND_REGEX);

            console.log(
                moreId.match(MORE_CURRENCIES_COMMAND_REGEX),
                MORE_CURRENCIES_COMMAND_REGEX.test(moreId)
            );

            await WhatsAppBotService.sendSelectSupportedCurrenciesMessage(
                {
                    userPhoneNumber: '2348143100808',
                    businessPhoneNumberId: process.env.WA_PHONE_NUMBER_ID!,
                },
                assetActionId,
                purchaseAssetId,
                nextSliceFrom,
                nextSliceTo
            );
        },
        TEN_THOUSAND * 5
    );
});
