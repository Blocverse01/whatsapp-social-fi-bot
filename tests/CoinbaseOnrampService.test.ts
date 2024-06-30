import CoinbaseOnrampService from '@/app/Coinbase/CoinbaseOnrampService';
import UserService from '@/app/User/UserService';

describe('CoinbaseOnrampService', () => {
    it('can get supported onramp countries', async () => {
        await CoinbaseOnrampService.getSupportedOnrampCountries();
    });

    it('can generate onramp URL', async () => {
        const userAssetInfo = await UserService.getUserAssetInfo('2348143100808', 'usdc-base');

        const onrampUrl = await CoinbaseOnrampService.generateOnrampUrl(userAssetInfo);

        console.log({ onrampUrl });
    });
});
