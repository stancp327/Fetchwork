# FetchWork

All-in-one freelance platform for remote and local services with secure payments, messaging, and AI support.

## 🚀 Features

FetchWork is a comprehensive freelance platform with the following implemented features:

### ✅ Core Platform Features
1. **Enhanced User System** - User profiles with bios, skills, work history, and profile pictures
2. **Job Posting & Management** - Clients can post jobs, freelancers can apply or submit offers
3. **Search & Filtering** - Universal search with filters for job type, location, budget, skills, and rating
4. **Real-time Messaging** - Live chat between freelancers and clients with file sharing and typing indicators
5. **Payment System** - Secure escrow payments with cooling-off period and admin override capabilities
6. **Rating & Review System** - Bidirectional reviews with admin moderation
7. **Admin Dashboard** - User management, analytics, dispute handling, and platform oversight
8. **Project Management** - Job timeline, progress tracker, calendar for deadlines and task reminders
9. **Security & Verification** - Email/SMS verification, fraud reporting, and enhanced security features
10. **AI Integration** - Chatbot for customer support with escalation to human agents

### 🏗️ Technical Features
- **Real-time Communication** - WebSocket integration with Socket.IO
- **Secure Authentication** - JWT-based auth with bcrypt password hashing
- **Database Integration** - MongoDB with Mongoose ODM
- **Responsive Design** - Mobile-friendly React components
- **Digital Content Protection** - Watermarking and anti-theft measures

## 📁 Project Structure

```
Fetchwork/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Auth/       # Login/Register components
│   │   │   ├── Dashboard/  # User dashboard
│   │   │   ├── Jobs/       # Job posting and browsing
│   │   │   ├── Messages/   # Real-time messaging
│   │   │   ├── Payments/   # Payment management
│   │   │   ├── Profile/    # User profiles
│   │   │   ├── Admin/      # Admin dashboard
│   │   │   ├── Projects/   # Project management
│   │   │   ├── Security/   # Security settings
│   │   │   ├── ChatBot/    # AI chatbot
│   │   │   └── Navigation/ # Site navigation
│   │   ├── context/        # React context providers
│   │   └── App.js          # Main application component
│   └── package.json        # Frontend dependencies
├── server/                 # Express backend application
│   ├── models/             # MongoDB/Mongoose models
│   ├── routes/             # API route handlers
│   ├── middleware/         # Authentication middleware
│   ├── index.js            # Server entry point
│   └── package.json        # Backend dependencies
└── README.md               # This file
```

## 🛠️ Setup Instructions

### Prerequisites

- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **MongoDB** (local installation or MongoDB Atlas account)

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/stancp327/Fetchwork.git
cd Fetchwork

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Database Setup

#### Option A: Local MongoDB
1. Install MongoDB locally
2. Start MongoDB service: `mongod`
3. Use connection string: `mongodb://localhost:27017/fetchwork`

#### Option B: MongoDB Atlas (Recommended)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get your connection string from the "Connect" button
4. Replace `<password>` and `<dbname>` in the connection string

### 3. Environment Configuration

Create `server/.env.local` file with the following variables:

```env
# Server Configuration
PORT=10000

# Database Configuration
MONGO_URI=mongodb://localhost:27017/fetchwork
# OR for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/fetchwork

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_key_here

# Optional: Email Configuration (for verification features)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Optional: SMS Configuration (for verification features)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone
```

### 4. Start Development Servers

#### Terminal 1 - Backend Server
```bash
cd server
node index.js
```
Server will start on http://localhost:10000

#### Terminal 2 - Frontend Application
```bash
cd client
npm start
```
Frontend will start on http://localhost:3000

### 5. Test User Credentials

For testing purposes, you can use these credentials:
- **Email:** Stancp327@gmail.com
- **Password:** JackieB!2271990

Or register a new account through the application.

## 🔧 Development Workflow

### Running the Application
1. Ensure MongoDB is running
2. Start backend server: `cd server && node index.js`
3. Start frontend app: `cd client && npm start`
4. Open http://localhost:3000 in your browser

### Building for Production
```bash
# Build frontend
cd client
npm run build

# The build folder will contain optimized production files
```

### Testing Features
- **Authentication:** Register/login functionality
- **Job Management:** Post and browse jobs
- **Messaging:** Real-time chat between users
- **Payments:** Escrow payment system
- **Admin Panel:** User and platform management
- **AI Chatbot:** Customer support assistant

## 🚨 Troubleshooting

### Common Issues

#### MongoDB Connection Issues
```
Error: MongoNetworkError: failed to connect to server
```
**Solution:** 
- Ensure MongoDB is running locally, or
- Check your MongoDB Atlas connection string and network access
- Verify MONGO_URI in .env.local file

#### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::10000
```
**Solution:**
- Kill existing process: `lsof -ti:10000 | xargs kill -9`
- Or change PORT in .env.local file

#### JWT Authentication Errors
```
Error: jwt malformed
```
**Solution:**
- Ensure JWT_SECRET is set in .env.local
- Clear browser localStorage and re-login

#### Frontend Build Errors
```
Module not found: Can't resolve...
```
**Solution:**
- Delete node_modules: `rm -rf node_modules package-lock.json`
- Reinstall dependencies: `npm install`

#### Socket.IO Connection Issues
```
WebSocket connection failed
```
**Solution:**
- Ensure backend server is running on port 10000
- Check CORS configuration in server/index.js

### Development Tips

1. **Hot Reload:** Frontend automatically reloads on changes
2. **API Testing:** Use tools like Postman to test API endpoints
3. **Database Inspection:** Use MongoDB Compass for database visualization
4. **Debugging:** Check browser console and server logs for errors

## 🚀 Production Deployment

### Environment Variables for Production
```env
NODE_ENV=production
MONGO_URI=your_production_mongodb_uri
JWT_SECRET=your_production_jwt_secret
FRONTEND_URL=https://your-domain.com
```

### Deployment Platforms
- **Frontend:** Vercel, Netlify, or AWS S3
- **Backend:** Heroku, AWS EC2, or DigitalOcean
- **Database:** MongoDB Atlas (recommended)

### Security Considerations
- Use strong JWT_SECRET (32+ characters)
- Enable MongoDB authentication
- Configure CORS for production domains
- Use HTTPS in production
- Set secure environment variables

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### User Management
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile
- `GET /api/users/search` - Search users

### Job Management
- `GET /api/jobs` - Get all jobs
- `POST /api/jobs` - Create new job
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job

### Messaging
- `GET /api/messages/conversations` - Get conversations
- `POST /api/messages/send` - Send message
- WebSocket events for real-time messaging

### Payments
- `POST /api/payments/create` - Create escrow payment
- `POST /api/payments/release` - Release payment
- `GET /api/payments/history` - Payment history

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact: stancp327@gmail.com

---
*FetchWork - Connecting talent with opportunity*
