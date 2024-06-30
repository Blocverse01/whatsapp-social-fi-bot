import CoinbaseApiService from '@/app/Coinbase/CoinbaseApiService';
import axios from 'axios';
import { GET_ONRAMP_CONFIG } from '@/app/Coinbase/endpoints';
import { UserAssetInfo } from '@/app/User/userSchema';
import { generateOnRampURL } from '@coinbase/cbpay-js';
import env from '@/constants/env';

class CoinbaseOnrampService extends CoinbaseApiService {
    public static async getSupportedOnrampCountries() {
        const authHeader = this.getRequestAuthHeader('GET', GET_ONRAMP_CONFIG);

        const requestUrl = this.API_URL + GET_ONRAMP_CONFIG;

        const response = await axios.get(requestUrl);

        console.log(response.data);
    }

    public static async generateOnrampUrl(asset: UserAssetInfo) {
        const options = {
            appId: this.PROJECT_ID,
            addresses: {
                [asset.walletAddress]: [asset.assetNetwork.toLowerCase()],
            },
            defaultAsset: asset.assetName.toLowerCase(),
            defaultExperience: 'buy' as const,
            defaultNetwork: asset.assetNetwork.toLowerCase(),
        };

        console.log({
            options,
        });

        return generateOnRampURL(options);
    }
}

export default CoinbaseOnrampService;
