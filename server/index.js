const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGO_URI)
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/auth', require('./routes/auth'));

// Simple route
app.get('/', (req, res) => {
  res.send('FetchWork backend running with MongoDB');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
