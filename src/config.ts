import dotenv from 'dotenv';

export const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
  dotenv.config();
}

export const {
  MONGO_URL,
  PORT = 8083,
  REV = '2'
} = process.env;