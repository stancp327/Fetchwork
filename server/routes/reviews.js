const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { authenticateToken } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { revieweeId, page = 1, limit = 10 } = req.query;
    
    if (!revieweeId) {
      return res.status(400).json({ error: 'revieweeId is required' });
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const reviews = await Review.findByReviewee(revieweeId, {
      limit: parseInt(limit),
      skip: skip
    });
    
    const total = await Review.countDocuments({
      reviewee: revieweeId,
      isPublic: true,
      moderationStatus: 'approved'
    });
    
    const averageRating = await Review.getAverageRating(revieweeId);
    
    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      averageRating: averageRating[0] || { averageRating: 0, totalReviews: 0 }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('reviewee', 'firstName lastName profilePicture')
      .populate('job', 'title category');
    
    if (!review || (!review.isPublic && review.moderationStatus !== 'approved')) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json({ review });
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      jobId,
      revieweeId,
      reviewerType,
      rating,
      title,
      comment,
      categories
    } = req.body;
    
    if (!jobId || !revieweeId || !reviewerType || !rating) {
      return res.status(400).json({ 
        error: 'jobId, revieweeId, reviewerType, and rating are required' 
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    if (revieweeId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot review yourself' });
    }
    
    const existingReview = await Review.findOne({
      job: jobId,
      reviewer: req.user.userId,
      reviewee: revieweeId
    });
    
    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this job' });
    }
    
    const review = new Review({
      job: jobId,
      reviewer: req.user.userId,
      reviewee: revieweeId,
      reviewerType,
      rating,
      title: title || '',
      comment: comment || '',
      categories: categories || {},
      moderationStatus: 'approved'
    });
    
    await review.save();
    
    const populatedReview = await Review.findById(review._id)
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('reviewee', 'firstName lastName profilePicture')
      .populate('job', 'title category');
    
    res.status(201).json({
      message: 'Review created successfully',
      review: populatedReview
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    if (review.reviewer.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to edit this review' });
    }
    
    const { rating, title, comment, categories } = req.body;
    
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (categories !== undefined) review.categories = { ...review.categories, ...categories };
    
    await review.save();
    
    const populatedReview = await Review.findById(review._id)
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('reviewee', 'firstName lastName profilePicture')
      .populate('job', 'title category');
    
    res.json({
      message: 'Review updated successfully',
      review: populatedReview
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

router.post('/:id/response', authenticateToken, async (req, res) => {
  try {
    const { responseText } = req.body;
    
    if (!responseText) {
      return res.status(400).json({ error: 'Response text is required' });
    }
    
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    if (review.reviewee.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the reviewee can respond to this review' });
    }
    
    await review.addResponse(responseText);
    
    const populatedReview = await Review.findById(review._id)
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('reviewee', 'firstName lastName profilePicture')
      .populate('job', 'title category');
    
    res.json({
      message: 'Response added successfully',
      review: populatedReview
    });
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({ error: 'Failed to add response' });
  }
});

router.post('/:id/helpful', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    await review.addHelpfulVote(req.user.userId);
    
    res.json({
      message: 'Helpful vote added',
      helpfulCount: review.helpfulVotes.count
    });
  } catch (error) {
    console.error('Error adding helpful vote:', error);
    res.status(500).json({ error: 'Failed to add helpful vote' });
  }
});

module.exports = router;
