const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Job = require('../models/Job');
const User = require('../models/User');
const auth = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { jobId, revieweeId, rating, comment, reviewType } = req.body;

    if (!jobId || !revieweeId || !rating || !comment || !reviewType) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ message: 'Can only review completed jobs' });
    }

    const existingReview = await Review.findOne({
      job: jobId,
      reviewer: req.user.id,
      reviewee: revieweeId
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this job' });
    }

    const review = new Review({
      job: jobId,
      reviewer: req.user.id,
      reviewee: revieweeId,
      rating,
      comment,
      reviewType
    });

    await review.save();

    await updateUserRating(revieweeId);

    const populatedReview = await Review.findById(review._id)
      .populate('reviewer', 'name profilePicture')
      .populate('reviewee', 'name profilePicture')
      .populate('job', 'title');

    res.status(201).json(populatedReview);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({
      reviewee: req.params.userId,
      isVisible: true
    })
    .populate('reviewer', 'name profilePicture')
    .populate('job', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Review.countDocuments({
      reviewee: req.params.userId,
      isVisible: true
    });

    res.json({
      reviews,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/job/:jobId', async (req, res) => {
  try {
    const reviews = await Review.find({
      job: req.params.jobId,
      isVisible: true
    })
    .populate('reviewer', 'name profilePicture')
    .populate('reviewee', 'name profilePicture')
    .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:reviewId/flag', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ message: 'Reason for flagging is required' });
    }

    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const alreadyFlagged = review.flaggedBy.some(
      flag => flag.user.toString() === req.user.id
    );

    if (alreadyFlagged) {
      return res.status(400).json({ message: 'You have already flagged this review' });
    }

    review.flaggedBy.push({
      user: req.user.id,
      reason
    });

    await review.save();

    res.json({ message: 'Review flagged successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:reviewId/moderate', auth, async (req, res) => {
  try {
    const { isVisible, adminNotes } = req.body;
    
    const user = await User.findById(req.user.id);
    if (user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.isVisible = isVisible;
    review.adminNotes = adminNotes || '';
    review.moderatedBy = req.user.id;
    review.moderatedAt = new Date();

    await review.save();

    if (isVisible !== undefined) {
      await updateUserRating(review.reviewee);
    }

    res.json({ message: 'Review moderated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

async function updateUserRating(userId) {
  try {
    const reviews = await Review.find({
      reviewee: userId,
      isVisible: true
    });

    if (reviews.length === 0) {
      await User.findByIdAndUpdate(userId, {
        'rating.average': 0,
        'rating.count': 0
      });
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    await User.findByIdAndUpdate(userId, {
      'rating.average': Math.round(averageRating * 10) / 10,
      'rating.count': reviews.length
    });
  } catch (error) {
    console.error('Error updating user rating:', error);
  }
}

module.exports = router;
