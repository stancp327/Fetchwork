// Load .env.local first (for local development), then .env as fallback
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const requiredEnvVars = {
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  FROM_EMAIL: process.env.FROM_EMAIL,
  CLIENT_URL: process.env.CLIENT_URL
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ DEPLOYMENT FAILURE: Missing critical environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}: Required for server startup`);
  });
  console.error('');
  console.error('Please configure these environment variables in your Render dashboard:');
  console.error('- MONGO_URI: MongoDB Atlas connection string');
  console.error('- JWT_SECRET: Secure secret key (minimum 32 characters)');
  console.error('- RESEND_API_KEY: Email service API key (starts with "re_")');
  console.error('- FROM_EMAIL: Email address for sending notifications');
  console.error('- CLIENT_URL: Frontend URL for email links and OAuth redirects');
  
  if (missingVars.includes('FROM_EMAIL') || missingVars.includes('RESEND_API_KEY')) {
    console.warn('⚠️  Email service may not function properly without proper configuration');
  }
  if (missingVars.includes('CLIENT_URL')) {
    console.warn('⚠️  OAuth and email links may not work without CLIENT_URL configuration');
  }
  
  process.exit(1);
}

// Warn if JWT_SECRET is too short (vulnerable to brute force)
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️  JWT_SECRET is shorter than 32 characters — consider using a stronger secret');
}

// Warn about default session secret in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.warn('⚠️  SESSION_SECRET not set — using fallback (not secure for production)');
}

console.log('✅ All critical environment variables present');

const ADMIN_EMAILS = ['admin@fetchwork.com', 'stancp327@gmail.com'];

// Optional — AI features degrade gracefully without it
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set — AI features (job description gen, smart matching) will use fallback mode');
}

module.exports = {
  PORT:           process.env.PORT || 10000,
  MONGO_URI:      process.env.MONGO_URI,
  JWT_SECRET:     process.env.JWT_SECRET,
  CLIENT_URL:     process.env.CLIENT_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || null,
  ADMIN_EMAILS,
};
