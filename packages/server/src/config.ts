import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    baseUrl: process.env.ANTHROPIC_BASE_URL || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  },

  dataDir: process.env.DATA_DIR || './data/claude-web',

  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
};

export function validateConfig(): void {
  if (config.nodeEnv === 'production') {
    if (config.jwt.secret === 'dev-jwt-secret-change-in-production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    if (config.jwt.refreshSecret === 'dev-refresh-secret-change-in-production') {
      throw new Error('JWT_REFRESH_SECRET must be set in production');
    }
  }

  if (!config.anthropic.apiKey) {
    console.warn('Warning: ANTHROPIC_API_KEY is not set. Claude Agent features will not work.');
  }
}
