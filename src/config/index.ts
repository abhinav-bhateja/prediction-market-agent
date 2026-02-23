import dotenv from 'dotenv';
import { configSchema, type AppConfig } from './schema.js';

dotenv.config();

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid configuration: ${parsed.error.message}`);
}

export const config: AppConfig = parsed.data;
