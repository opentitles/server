import dotenv from 'dotenv';

export const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
  dotenv.config();
}

export const {
  MONGO_URL,
  PORT = 8059,
  REV = '2',
  EXPECTED_TELEMETRY_AUTH
} = process.env;