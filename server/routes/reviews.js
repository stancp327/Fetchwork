const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Job = require('../models/Job');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { jobId, revieweeId, rating, title, comment, categories } = req.body;
    
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.client.toString() !== req.user._id.toString() && job.freelancer?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You are not authorized to review this job' });
    }
    
    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Can only review completed jobs' });
    }
    
    const existingReview = await Review.findOne({
      job: jobId,
      reviewer: req.user._id,
      reviewee: revieweeId
    });
    
    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this job' });
    }
    
    const reviewerType = job.client.toString() === req.user._id.toString() ? 'client' : 'freelancer';
    
    const review = new Review({
      job: jobId,
      reviewer: req.user._id,
      reviewee: revieweeId,
      reviewerType,
      rating,
      title: title || '',
      comment: comment || '',
      categories: categories || {},
      moderationStatus: 'pending'
    });
    
    await review.save();
    
    const reviewee = await User.findById(revieweeId);
    if (reviewee) {
      await reviewee.calculateRating();
    }
    
    res.status(201).json({
      message: 'Review submitted successfully',
      review
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const reviews = await Review.find({
      reviewee: userId,
      isPublic: true,
      moderationStatus: 'approved'
    })
    .populate('reviewer', 'firstName lastName profilePicture')
    .populate('job', 'title')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
    
    const total = await Review.countDocuments({
      reviewee: userId,
      isPublic: true,
      moderationStatus: 'approved'
    });
    
    const averageRating = reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
    
    res.json({
      reviews,
      averageRating: Math.round(averageRating * 10) / 10,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.get('/my-reviews', authenticateToken, async (req, res) => {
  try {
    const reviews = await Review.find({
      $or: [
        { reviewer: req.user._id },
        { reviewee: req.user._id }
      ]
    })
    .populate('reviewer reviewee', 'firstName lastName profilePicture')
    .populate('job', 'title')
    .sort({ createdAt: -1 });
    
    res.json({ reviews });
  } catch (error) {
    console.error('Error fetching my reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;
