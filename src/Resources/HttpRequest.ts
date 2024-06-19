import env from '@/constants/env';


export const createRequestOptions = (method: string, endpoint: string, requestBody: string | object = {}) => {
  return {
    method, 
    url: `${env.CLOUD_API_URL}/${endpoint}`,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${env.CLOUD_API_ACCESS_TOKEN}`,
    }
  };
};

