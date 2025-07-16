const express = require('express');
const router = express.Router();
const { ChatSession, KnowledgeBase } = require('../models/ChatBot');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

class MockAIService {
  static async generateResponse(userMessage, context = {}) {
    const message = userMessage.toLowerCase();
    
    const responses = {
      'hello': 'Hello! I\'m here to help you with any questions about FetchWork. How can I assist you today?',
      'hi': 'Hi there! Welcome to FetchWork support. What can I help you with?',
      'payment': 'I can help you with payment-related questions. Are you having trouble with a payment, need to understand our escrow system, or have questions about fees?',
      'job': 'I can assist with job-related questions. Are you looking to post a job, apply for work, or manage an existing project?',
      'account': 'I can help with account issues. Are you having trouble logging in, need to verify your account, or want to update your profile?',
      'dispute': 'For disputes, I can provide initial guidance, but complex issues may need human review. Can you describe the nature of your dispute?',
      'help': 'I\'m here to help! I can assist with payments, jobs, account issues, technical problems, and general questions about FetchWork.',
      'technical': 'I can help with technical issues. Are you experiencing problems with the website, mobile app, or specific features?',
      'freelancer': 'I can help freelancers with profile setup, finding jobs, managing projects, and getting paid. What specific area do you need help with?',
      'client': 'I can assist clients with posting jobs, finding freelancers, managing projects, and making payments. What would you like to know?'
    };
    
    for (const [keyword, response] of Object.entries(responses)) {
      if (message.includes(keyword)) {
        return {
          content: response,
          confidence: 0.8,
          intent: keyword,
          shouldEscalate: false
        };
      }
    }
    
    const escalationKeywords = ['speak to human', 'human agent', 'escalate', 'manager', 'supervisor', 'complex issue'];
    const shouldEscalate = escalationKeywords.some(keyword => message.includes(keyword));
    
    if (shouldEscalate) {
      return {
        content: 'I understand you\'d like to speak with a human agent. Let me connect you with our support team. Please hold on while I transfer your conversation.',
        confidence: 0.9,
        intent: 'escalation',
        shouldEscalate: true
      };
    }
    
    return {
      content: 'I\'m not sure I understand your question completely. Could you please rephrase it or choose from these common topics: payments, jobs, account issues, or technical support? You can also ask to speak with a human agent.',
      confidence: 0.3,
      intent: 'unknown',
      shouldEscalate: false
    };
  }
}

router.post('/start', auth, async (req, res) => {
  try {
    const sessionId = uuidv4();
    
    const chatSession = new ChatSession({
      user: req.user.userId,
      sessionId,
      messages: [{
        role: 'assistant',
        content: 'Hello! I\'m the FetchWork AI assistant. I\'m here to help you with questions about payments, jobs, account issues, and more. How can I assist you today?',
        metadata: {
          confidence: 1.0,
          intent: 'greeting'
        }
      }]
    });
    
    await chatSession.save();
    
    res.json({
      sessionId,
      message: 'Chat session started successfully',
      initialMessage: chatSession.messages[0]
    });
  } catch (error) {
    console.error('Error starting chat session:', error);
    res.status(500).json({ error: 'Failed to start chat session' });
  }
});

router.post('/message', auth, async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }
    
    const chatSession = await ChatSession.findOne({
      sessionId,
      user: req.user.userId
    });
    
    if (!chatSession) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    chatSession.messages.push({
      role: 'user',
      content: message
    });
    
    const aiResponse = await MockAIService.generateResponse(message, {
      userId: req.user.userId,
      sessionHistory: chatSession.messages
    });
    
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse.content,
      metadata: {
        confidence: aiResponse.confidence,
        intent: aiResponse.intent
      }
    };
    
    chatSession.messages.push(assistantMessage);
    
    if (aiResponse.shouldEscalate && !chatSession.escalatedToHuman) {
      chatSession.escalatedToHuman = true;
      chatSession.escalatedAt = new Date();
      chatSession.status = 'escalated';
      chatSession.priority = 'high';
    }
    
    await chatSession.save();
    
    res.json({
      message: assistantMessage,
      escalated: aiResponse.shouldEscalate,
      sessionStatus: chatSession.status
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

router.get('/history/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const chatSession = await ChatSession.findOne({
      sessionId,
      user: req.user.userId
    });
    
    if (!chatSession) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    res.json({
      sessionId: chatSession.sessionId,
      messages: chatSession.messages,
      status: chatSession.status,
      escalated: chatSession.escalatedToHuman,
      category: chatSession.category
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

router.get('/sessions', auth, async (req, res) => {
  try {
    const sessions = await ChatSession.find({
      user: req.user.userId
    })
    .select('sessionId status category createdAt messages')
    .sort({ createdAt: -1 })
    .limit(20);
    
    const sessionSummaries = sessions.map(session => ({
      sessionId: session.sessionId,
      status: session.status,
      category: session.category,
      createdAt: session.createdAt,
      messageCount: session.messages.length,
      lastMessage: session.messages[session.messages.length - 1]?.content.substring(0, 100) + '...'
    }));
    
    res.json(sessionSummaries);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
});

router.post('/rate', auth, async (req, res) => {
  try {
    const { sessionId, rating, feedback } = req.body;
    
    if (!sessionId || !rating) {
      return res.status(400).json({ error: 'Session ID and rating are required' });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    const chatSession = await ChatSession.findOne({
      sessionId,
      user: req.user.userId
    });
    
    if (!chatSession) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    chatSession.satisfaction = {
      rating,
      feedback: feedback || '',
      ratedAt: new Date()
    };
    
    if (chatSession.status === 'active') {
      chatSession.status = 'resolved';
      chatSession.resolved = true;
      chatSession.resolvedAt = new Date();
    }
    
    await chatSession.save();
    
    res.json({ message: 'Thank you for your feedback!' });
  } catch (error) {
    console.error('Error rating chat session:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

router.post('/close', auth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    const chatSession = await ChatSession.findOne({
      sessionId,
      user: req.user.userId
    });
    
    if (!chatSession) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    chatSession.status = 'closed';
    chatSession.resolved = true;
    chatSession.resolvedAt = new Date();
    
    await chatSession.save();
    
    res.json({ message: 'Chat session closed successfully' });
  } catch (error) {
    console.error('Error closing chat session:', error);
    res.status(500).json({ error: 'Failed to close chat session' });
  }
});

router.get('/admin/sessions', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);
    
    if (!user || user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { status, escalated, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (escalated === 'true') query.escalatedToHuman = true;
    
    const sessions = await ChatSession.find(query)
      .populate('user', 'email profile.firstName profile.lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await ChatSession.countDocuments(query);
    
    res.json({
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching admin chat sessions:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
});

module.exports = router;
