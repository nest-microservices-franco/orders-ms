import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  DATABASE_URL: string;
  PRODUCT_MS_HOST: string;
  PRODUCT_MS_PORT: number;
}

const envsSchema = joi
  .object({
    PORT: joi.number().required(),
    DATABASE_URL: joi.string().required(),
    PRODUCT_MS_HOST: joi.string().required(),
    PRODUCT_MS_PORT: joi.number().required(),
  })
  .unknown(true);

const { error, value } = envsSchema.validate(process.env);

if (error) throw new Error(`Config validation error: ${error.message}`);

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  databaseUrl: envVars.DATABASE_URL,
  productMsHost: envVars.PRODUCT_MS_HOST,
  productMsPort: envVars.PRODUCT_MS_PORT,
};
