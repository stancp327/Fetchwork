# Render Deployment Troubleshooting Guide

## Critical Environment Variables

The following environment variables MUST be configured in your Render dashboard for successful deployment:

### Required (Server crashes if missing)
- `MONGO_URI`: MongoDB Atlas connection string with authentication
  - Format: `mongodb+srv://username:password@cluster.mongodb.net/fetchwork`
  - Must include `authSource=admin` for Atlas
- `JWT_SECRET`: Secure secret key for JWT signing
  - Minimum 32 characters for security
  - Example: `your_super_secure_jwt_secret_minimum_32_characters`
- `RESEND_API_KEY`: Email service API key
  - Must start with `re_`
  - Critical startup dependency per documentation

### Recommended
- `NODE_ENV`: Set to `production`
- `PORT`: Server port (defaults to 10000 if not set)

## Deployment Failure Scenarios

### "Exited with status 127" Error
**Cause**: Missing Node.js version specification
**Solution**: ✅ Fixed in PR #51 - `engines` field added to package.json

### Server Startup Crashes
**Cause**: Missing `MONGO_URI` environment variable
**Error**: `MongooseError: The uri parameter to openUri() must be a string, got "undefined"`
**Solution**: Configure `MONGO_URI` in Render dashboard

### Authentication Failures
**Cause**: Missing `JWT_SECRET` environment variable
**Error**: `secretOrPrivateKey must have a value`
**Solution**: Configure `JWT_SECRET` in Render dashboard

### Email Service Failures
**Cause**: Missing `RESEND_API_KEY` environment variable
**Error**: `Missing API key. Pass it to the constructor new Resend("re_...`
**Solution**: Configure `RESEND_API_KEY` in Render dashboard

## Verification Commands

### Local Testing
```bash
# Test server startup with missing environment variables
cd server
unset MONGO_URI JWT_SECRET RESEND_API_KEY
npm start  # Should fail with clear error messages
```

### Production Testing
```bash
# Verify deployment health
npm run verify-deployment

# Manual endpoint testing
curl https://fetchwork-1.onrender.com/health
curl https://fetchwork-1.onrender.com/test-db
```

## Render Configuration Checklist

- [ ] Service Type: Web Service
- [ ] Root Directory: `server`
- [ ] Build Command: `npm install`
- [ ] Start Command: `npm start`
- [ ] Node.js Version: 18.20.4 (specified in package.json engines)
- [ ] Environment Variables:
  - [ ] `MONGO_URI` configured
  - [ ] `JWT_SECRET` configured  
  - [ ] `RESEND_API_KEY` configured
  - [ ] `NODE_ENV=production`

## Monitoring

Use the health check endpoint to monitor deployment status:
- URL: `https://fetchwork-1.onrender.com/health`
- Returns 200 if healthy, 503 if issues detected
- Includes environment variable status and service health

## CI/CD Integration

Add deployment verification to your GitHub Actions workflow:

```yaml
- name: Verify Render Deployment
  run: |
    cd server
    npm run verify-deployment
  env:
    BACKEND_URL: https://fetchwork-1.onrender.com
```

## Troubleshooting Steps

1. **Check Environment Variables**
   ```bash
   curl https://fetchwork-1.onrender.com/health
   ```
   Look for any variables showing "missing" status.

2. **Verify Database Connection**
   ```bash
   curl https://fetchwork-1.onrender.com/test-db
   ```
   Should return "connected" status.

3. **Check Render Logs**
   - Go to Render dashboard
   - Select your service
   - View "Logs" tab for startup errors

4. **Test Locally**
   ```bash
   cd server
   # Remove environment variables to simulate missing config
   unset MONGO_URI JWT_SECRET RESEND_API_KEY
   npm start
   ```
   Should show clear error messages about missing variables.

## Common Issues

### Issue: Server starts but crashes immediately
**Cause**: Environment variables missing after startup
**Solution**: Check all required variables are set in Render dashboard

### Issue: Database connection fails
**Cause**: Invalid MONGO_URI or network restrictions
**Solution**: Verify MongoDB Atlas allows connections from Render IPs

### Issue: Authentication endpoints return 500 errors
**Cause**: Missing or invalid JWT_SECRET
**Solution**: Set JWT_SECRET to a secure string (32+ characters)

### Issue: Email functionality fails
**Cause**: Missing or invalid RESEND_API_KEY
**Solution**: Configure valid Resend API key starting with "re_"
