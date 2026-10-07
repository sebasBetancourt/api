import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.DB_NAME || 'netflix-reviews-db'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  environment: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

// Validar variables de entorno críticas
if (!process.env.JWT_SECRET && config.environment === 'production') {
  console.error('ERROR: JWT_SECRET no está definido para entorno de producción');
  process.exit(1);
}

if (!process.env.MONGODB_URI && config.environment === 'production') {
  console.error('ERROR: MONGODB_URI no está definido para entorno de producción');
  process.exit(1);
}

export default config;