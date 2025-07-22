const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const User = require('../models/User');
const Job = require('../models/Job');
const auth = require('../middleware/auth');

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, type = 'all' } = req.query;
    
    let query = {
      revieweeId: userId,
      isPublic: true,
      'adminModeration.flagged': false
    };
    
    if (type !== 'all') {
      query.reviewType = type;
    }
    
    const reviews = await Review.find(query)
      .populate('reviewerId', 'profile.firstName profile.lastName userType')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Review.countDocuments(query);
    const averageData = await Review.getAverageRatingForUser(userId);
    const categoryAverages = await Review.getCategoryAveragesForUser(userId);
    
    res.json({
      reviews,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      },
      averageRating: averageData.average,
      totalReviews: averageData.count,
      categoryAverages
    });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/job/:jobId', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const reviews = await Review.find({
      jobId,
      isPublic: true,
      'adminModeration.flagged': false
    })
    .populate('reviewerId', 'profile.firstName profile.lastName userType')
    .populate('revieweeId', 'profile.firstName profile.lastName userType')
    .sort({ createdAt: -1 });
    
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching job reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const {
      jobId,
      revieweeId,
      rating,
      title,
      comment,
      reviewType,
      categories
    } = req.body;
    
    if (!jobId || !revieweeId || !rating || !title || !comment || !reviewType) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }
    
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    const isClient = job.clientId.toString() === req.user.userId;
    const isFreelancer = job.assignedTo && job.assignedTo.toString() === req.user.userId;
    
    if (!isClient && !isFreelancer) {
      return res.status(403).json({ message: 'Not authorized to review this job' });
    }
    
    if ((reviewType === 'client_to_freelancer' && !isClient) ||
        (reviewType === 'freelancer_to_client' && !isFreelancer)) {
      return res.status(400).json({ message: 'Invalid review type for user role' });
    }
    
    const existingReview = await Review.findOne({
      jobId,
      reviewerId: req.user.userId,
      reviewType
    });
    
    if (existingReview) {
      return res.status(400).json({ message: 'Review already exists for this job' });
    }
    
    const review = new Review({
      jobId,
      reviewerId: req.user.userId,
      revieweeId,
      rating,
      title,
      comment,
      reviewType,
      categories: categories || {}
    });
    
    await review.save();
    
    const averageData = await Review.getAverageRatingForUser(revieweeId);
    await User.findByIdAndUpdate(revieweeId, {
      'rating.average': averageData.average,
      'rating.count': averageData.count
    });
    
    await review.populate('reviewerId', 'profile.firstName profile.lastName userType');
    await review.populate('revieweeId', 'profile.firstName profile.lastName userType');
    await review.populate('jobId', 'title');
    
    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:reviewId', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment, categories } = req.body;
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    if (!review.canEdit(req.user.userId)) {
      return res.status(403).json({ message: 'Not authorized to edit this review' });
    }
    
    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (categories !== undefined) review.categories = { ...review.categories, ...categories };
    
    await review.save();
    
    const averageData = await Review.getAverageRatingForUser(review.revieweeId);
    await User.findByIdAndUpdate(review.revieweeId, {
      'rating.average': averageData.average,
      'rating.count': averageData.count
    });
    
    await review.populate('reviewerId', 'profile.firstName profile.lastName userType');
    await review.populate('revieweeId', 'profile.firstName profile.lastName userType');
    await review.populate('jobId', 'title');
    
    res.json(review);
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:reviewId/response', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { responseText } = req.body;
    
    if (!responseText || responseText.trim().length === 0) {
      return res.status(400).json({ message: 'Response text is required' });
    }
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    if (!review.canRespond(req.user.userId)) {
      return res.status(403).json({ message: 'Not authorized to respond to this review' });
    }
    
    review.response = {
      hasResponse: true,
      responseText: responseText.trim(),
      responseDate: new Date()
    };
    
    await review.save();
    
    await review.populate('reviewerId', 'profile.firstName profile.lastName userType');
    await review.populate('revieweeId', 'profile.firstName profile.lastName userType');
    await review.populate('jobId', 'title');
    
    res.json(review);
  } catch (error) {
    console.error('Error adding review response:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:reviewId/flag', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ message: 'Flag reason is required' });
    }
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    if (!review.canFlag(req.user.userId)) {
      return res.status(403).json({ message: 'Cannot flag this review' });
    }
    
    review.adminModeration.flagged = true;
    review.adminModeration.flaggedBy = req.user.userId;
    review.adminModeration.flaggedReason = reason.trim();
    review.adminModeration.flaggedDate = new Date();
    
    await review.save();
    
    res.json({ message: 'Review flagged for admin review' });
  } catch (error) {
    console.error('Error flagging review:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/admin/flagged', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const reviews = await Review.find({
      'adminModeration.flagged': true,
      'adminModeration.adminReviewed': false
    })
    .populate('reviewerId', 'profile.firstName profile.lastName userType')
    .populate('revieweeId', 'profile.firstName profile.lastName userType')
    .populate('adminModeration.flaggedBy', 'profile.firstName profile.lastName')
    .populate('jobId', 'title')
    .sort({ 'adminModeration.flaggedDate': -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
    const total = await Review.countDocuments({
      'adminModeration.flagged': true,
      'adminModeration.adminReviewed': false
    });
    
    res.json({
      reviews,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching flagged reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/admin/:reviewId/moderate', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { action, notes } = req.body;
    
    if (!['approved', 'removed', 'edited'].includes(action)) {
      return res.status(400).json({ message: 'Invalid admin action' });
    }
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    review.adminModeration.adminReviewed = true;
    review.adminModeration.adminId = req.user.userId;
    review.adminModeration.adminAction = action;
    review.adminModeration.adminNotes = notes || '';
    review.adminModeration.adminDate = new Date();
    
    if (action === 'removed') {
      review.isPublic = false;
    }
    
    await review.save();
    
    if (action === 'removed') {
      const averageData = await Review.getAverageRatingForUser(review.revieweeId);
      await User.findByIdAndUpdate(review.revieweeId, {
        'rating.average': averageData.average,
        'rating.count': averageData.count
      });
    }
    
    res.json({ message: `Review ${action} successfully` });
  } catch (error) {
    console.error('Error moderating review:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:reviewId', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    if (review.reviewerId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }
    
    review.isPublic = false;
    await review.save();
    
    const averageData = await Review.getAverageRatingForUser(review.revieweeId);
    await User.findByIdAndUpdate(review.revieweeId, {
      'rating.average': averageData.average,
      'rating.count': averageData.count
    });
    
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
