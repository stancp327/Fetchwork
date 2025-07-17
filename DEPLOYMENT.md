# FetchWork Deployment Guide

## Production Hosting Setup

### Backend Deployment (Railway)

1. **Sign up for Railway**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub account

2. **Deploy Backend**
   - Create new project from GitHub repository
   - Select the `server` directory as the root
   - Railway will automatically detect Node.js and deploy

3. **Add MongoDB Database**
   - In Railway dashboard, click "Add Service"
   - Select "Database" → "MongoDB"
   - Railway will provide connection string automatically

4. **Configure Environment Variables**
   ```
   MONGO_URI=<Railway MongoDB connection string>
   JWT_SECRET=fetchwork_production_jwt_secret_2025_7d8f9a2b4c6e1f3a5b7c9d0e2f4a6b8c
   PORT=<Railway auto-assigned port>
   ```

5. **Note the Backend URL**
   - Railway will provide a URL like: `https://fetchwork-api.railway.app`

### Frontend Deployment (Vercel)

1. **Sign up for Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub account

2. **Deploy Frontend**
   - Import project from GitHub
   - Select the `client` directory as the root
   - Vercel will automatically detect React and deploy

3. **Configure Environment Variables**
   ```
   REACT_APP_API_URL=https://fetchwork-api.railway.app
   ```

4. **Configure Custom Domain (Optional)**
   - In Vercel dashboard, go to Settings → Domains
   - Add `fetchwork.net` and `www.fetchwork.net`
   - Follow Vercel's DNS configuration instructions

4. **Note the Frontend URL**
   - Vercel will provide a URL like: `https://fetchwork.net` (or `https://fetchwork.vercel.app` initially)

### Final Configuration

1. **Update Backend CORS**
   - CORS is already configured for `fetchwork.net` and Vercel domains
   - Redeploy backend if needed

2. **Test Production Deployment**
   - Visit the Vercel frontend URL
   - Test user registration and login
   - Verify admin dashboard loads without errors
   - Test job posting and browsing functionality

## Cost Structure

### Railway (Backend + Database)
- **Free Tier**: $0/month
  - 512MB RAM
  - 1GB disk space
  - Shared CPU
  - MongoDB included

- **Pro Plan**: $20/month when you need to scale
  - 8GB RAM
  - 100GB disk space
  - Dedicated CPU

### Vercel (Frontend)
- **Hobby Plan**: $0/month
  - 100GB bandwidth
  - Unlimited static sites
  - Custom domains

- **Pro Plan**: $20/month when you need to scale
  - 1TB bandwidth
  - Advanced analytics
  - Team collaboration

## Benefits

- **Automatic deployments** from GitHub
- **SSL certificates** included
- **Global CDN** for fast loading
- **Automatic scaling** as your user base grows
- **Database backups** included with Railway
- **Custom domains** supported on both platforms
