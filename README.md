# FetchWork

All-in-one freelance platform for remote and local services with secure payments, messaging, and AI support.

> **Note**: This project uses Node.js v18.20.4 for optimal compatibility.

## Structure

- `client/` - React frontend
- `server/` - Express backend

## Getting Started

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

### 3. Environment Variables (example for `server/.env`)

```
PORT=10000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```
