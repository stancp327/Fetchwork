# FetchWork

All-in-one freelance platform for remote and local services with secure payments, messaging, and AI support.

## Structure

- `client/` - React frontend
- `server/` - Express backend with JWT authentication

## Getting Started

### Prerequisites
- Node.js (v18.20.4 recommended)
- MongoDB

### 1. Install Dependencies

From the root of `client` and `server`, run:
```
npm install
```

### 2. Start Development Servers

From `client/`:
```
npm start
```

From `server/`:
```
node index.js
```

### 3. Environment Variables

#### Server (.env.local)
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your-super-secure-jwt-secret-key
PORT=10000
```

#### Client (.env.local)
```
REACT_APP_API_URL=http://localhost:10000
```

## Authentication System

### JWT Specifications
- **Algorithm**: HS256 (HMAC SHA-256)
- **Token Expiry**: 7 days from issue
- **Password Hashing**: bcrypt with 12 salt rounds
- **Header Format**: `Authorization: Bearer {token}`
- **Secret**: Configured via `JWT_SECRET` environment variable

### Security Features
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Cross-origin resource sharing enabled
- **Helmet**: Security headers applied
- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Signing**: HS256 algorithm with secure secret

## API Endpoints

### Authentication Routes

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  }
}
```

**Validation:**
- Email and password required
- Password minimum 6 characters
- Email must be unique

#### POST /api/auth/login
Authenticate existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  }
}
```

### Utility Routes

#### GET /test-db
Check MongoDB connection status.

**Response:** `✅ MongoDB Connected!` or `❌ MongoDB Not Connected`

### Using JWT Tokens

Include the JWT token in the Authorization header for protected routes:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Error Responses

All endpoints return consistent error format:
```json
{
  "error": "Error message description"
}
```

**Common Error Codes:**
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid credentials)
- **403**: Forbidden (invalid token)
- **500**: Internal Server Error

## Development

### Testing Authentication Locally

```bash
# Register new user
curl -X POST http://localhost:10000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Login user
curl -X POST http://localhost:10000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Test database connection
curl http://localhost:10000/test-db
```

### Running with Helper Scripts

```bash
# Start both client and server (from root)
npm run dev

# Or start individually
npm run client  # React frontend on :3000
npm run server  # Express backend on :10000
```

## Deployment

- **Backend**: Deployed on Render at `https://fetchwork-1.onrender.com`
- **Frontend**: Deployed on Vercel
- **Database**: MongoDB Atlas

### Production Environment Variables

Ensure the following environment variables are configured in your production environment:
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secure secret key for JWT signing
- `PORT`: Server port (defaults to 10000)
