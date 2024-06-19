import { z } from 'zod';

const notEmptyStringSchema = (variableName: string) =>
    z.string().refine((val) => val.trim() !== '', {
        message: `Please set ${variableName} in .env`,
        path: [variableName],
    });

const envSchema = z.object({
    PORT: z.coerce.number().default(5123),
    CLOUD_API_ACCESS_TOKEN: z.string(),
    WEBHOOK_VERIFY_TOKEN: z.string(),
    CLOUD_API_URL : z.string()
});

const env = envSchema.parse(process.env);

export default env;