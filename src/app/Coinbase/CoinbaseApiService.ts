import env from '@/constants/env';
import { COINBASE_API_DOMAIN, COINBASE_API_URL } from '@/app/Coinbase/endpoints';
import { JwtPayload, sign, SignOptions } from 'jsonwebtoken';

class CoinbaseApiService {
    private static API_KEY_NAME = env.CDP_KEY_NAME;
    private static API_SECRET_KEY = Buffer.from(env.CDP_KEY_SECRET, 'base64').toString('ascii');
    private static API_DOMAIN = COINBASE_API_DOMAIN;
    protected static API_URL = COINBASE_API_URL;
    protected static PROJECT_ID = env.CDP_PROJECT_ID;

    private static generateJwtSignature(requestMethod: 'POST' | 'GET', requestPath: string) {
        const uri = requestMethod + ' ' + this.API_DOMAIN + requestPath;

        const payload: JwtPayload = {
            iss: 'cdp',
            nbf: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 120,
            sub: this.API_KEY_NAME,
            uri,
        };

        const options: SignOptions = {
            algorithm: 'ES256',
            header: {
                kid: this.API_KEY_NAME,
                alg: 'ES256',
            },
        };

        return sign(payload, this.API_SECRET_KEY, options);
    }

    protected static getRequestAuthHeader(requestMethod: 'POST' | 'GET', requestPath: string) {
        const jwtToken = this.generateJwtSignature(requestMethod, requestPath);

        return {
            Authorization: `Bearer ${jwtToken}`,
        };
    }
}

export default CoinbaseApiService;
