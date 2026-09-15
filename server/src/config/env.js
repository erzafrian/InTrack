const dotenv = require('dotenv');
const path = require('path');

// Keep deployment/server overrides, then fall back to the shared project .env.
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucketName: process.env.S3_BUCKET_NAME || 'getabsen',
    publicUrl: process.env.S3_PUBLIC_URL,
  },

  notion: {
    clientId: process.env.NOTION_CLIENT_ID,
    clientSecret: process.env.NOTION_CLIENT_SECRET,
    redirectUri: process.env.NOTION_REDIRECT_URI || 'http://localhost:3001/api/auth/notion/callback',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/callback',
  },

  office: {
    latitude: parseFloat(process.env.OFFICE_LATITUDE || '-6.2088'),
    longitude: parseFloat(process.env.OFFICE_LONGITUDE || '106.8456'),
  },

  ai: {
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_BASE_URL || 'https://router.getcore.id/v1',
    model: process.env.AI_MODEL || 'gemini-2.5-flash',
  },

  faceService: {
    baseUrl: process.env.FACE_SERVICE_URL || 'http://127.0.0.1:8001',
  },
};
