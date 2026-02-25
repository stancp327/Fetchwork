const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MONGO_URI } = require('../config/env');
const User = require('../models/User');
const Job = require('../models/Job');
const Review = require('../models/Review');

const reviewTemplates = [
  { rating: 5, title: 'Exceptional work!', comment: 'Delivered ahead of schedule with outstanding quality. Communication was top-notch throughout the project. Would definitely hire again!', cats: { communication: 5, quality: 5, timeliness: 5, professionalism: 5, value: 5 } },
  { rating: 5, title: 'Highly recommend', comment: 'Went above and beyond what was asked. Very professional and responsive. The final result exceeded my expectations.', cats: { communication: 5, quality: 5, timeliness: 5, professionalism: 5, value: 4 } },
  { rating: 5, title: 'Perfect execution', comment: 'Understood the requirements immediately and delivered exactly what I needed. Clean work, great communication.', cats: { communication: 5, quality: 5, timeliness: 5, professionalism: 5, value: 5 } },
  { rating: 4, title: 'Great job overall', comment: 'Very solid work. Had a couple of minor revisions but handled them quickly and professionally. Happy with the result.', cats: { communication: 4, quality: 4, timeliness: 4, professionalism: 5, value: 4 } },
  { rating: 4, title: 'Good experience', comment: 'Reliable and skilled. Delivered on time and was easy to work with. Would use their services again for future projects.', cats: { communication: 4, quality: 4, timeliness: 5, professionalism: 4, value: 4 } },
  { rating: 4, title: 'Solid professional', comment: 'Knew exactly what they were doing. A few back-and-forth messages to nail the details but the end product was great.', cats: { communication: 4, quality: 5, timeliness: 4, professionalism: 4, value: 4 } },
  { rating: 5, title: 'Amazing talent', comment: 'This freelancer is incredibly talented. The work quality was museum-worthy. Fast turnaround and very communicative.', cats: { communication: 5, quality: 5, timeliness: 5, professionalism: 5, value: 5 } },
  { rating: 4, title: 'Very pleased', comment: 'Professional approach from start to finish. Provided updates regularly and the deliverable was well-polished.', cats: { communication: 5, quality: 4, timeliness: 4, professionalism: 5, value: 4 } },
  { rating: 3, title: 'Decent work', comment: 'Got the job done but took a bit longer than expected. Quality was acceptable. Communication could improve.', cats: { communication: 3, quality: 3, timeliness: 3, professionalism: 4, value: 3 } },
  { rating: 5, title: 'Best freelancer I\'ve worked with', comment: 'Truly outstanding in every way. Proactive communication, creative solutions, and delivered a product that was better than what I envisioned.', cats: { communication: 5, quality: 5, timeliness: 5, professionalism: 5, value: 5 } },
  { rating: 4, title: 'Would hire again', comment: 'Competent and professional. Made helpful suggestions that improved the final product. Minor delays but nothing major.', cats: { communication: 4, quality: 5, timeliness: 3, professionalism: 5, value: 4 } },
  { rating: 5, title: 'Quick and quality work', comment: 'Turned around the project faster than expected without sacrificing quality. Very impressed with the attention to detail.', cats: { communication: 5, quality: 5, timeliness: 5, professionalism: 5, value: 5 } },
  { rating: 4, title: 'Reliable freelancer', comment: 'Always available when needed and delivered consistent quality. A dependable professional I can count on.', cats: { communication: 4, quality: 4, timeliness: 5, professionalism: 5, value: 4 } },
  { rating: 5, title: 'Exceeded expectations', comment: 'Not only delivered what was requested but also suggested improvements I hadn\'t considered. True expert in their field.', cats: { communication: 5, quality: 5, timeliness: 5, professionalism: 5, value: 5 } },
  { rating: 3, title: 'Okay but room for improvement', comment: 'The work was functional but lacked the polish I expected. Had to request several revisions. Fair value for the price though.', cats: { communication: 3, quality: 3, timeliness: 3, professionalism: 3, value: 3 } },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Get all users
  const allUsers = await User.find({ isActive: true }).select('_id firstName lastName accountType');
  const freelancers = allUsers.filter(u => ['freelancer', 'both'].includes(u.accountType));
  const clients = allUsers.filter(u => ['client', 'both'].includes(u.accountType));
  
  if (freelancers.length === 0 || clients.length === 0) {
    console.log('Need at least 1 freelancer and 1 client. Found:', freelancers.length, 'freelancers,', clients.length, 'clients');
    // If no clients, use freelancers as reviewers too
    if (clients.length === 0) clients.push(...freelancers);
  }

  // Get jobs (for linking reviews to jobs)
  const jobs = await Job.find({}).select('_id title client freelancer').limit(50);
  
  // Delete existing seed reviews (optional — keeps it idempotent)
  const existingCount = await Review.countDocuments();
  console.log(`Existing reviews: ${existingCount}`);

  let created = 0;
  const usedPairs = new Set();

  for (const freelancer of freelancers) {
    // Each freelancer gets 2-5 reviews
    const numReviews = 2 + Math.floor(Math.random() * 4);
    
    for (let i = 0; i < numReviews; i++) {
      // Pick a random client (not the freelancer themselves)
      const eligibleClients = clients.filter(c => c._id.toString() !== freelancer._id.toString());
      if (eligibleClients.length === 0) continue;
      
      const reviewer = eligibleClients[Math.floor(Math.random() * eligibleClients.length)];
      const pairKey = `${reviewer._id}-${freelancer._id}`;
      
      // Find a job between them, or pick any job
      let job = jobs.find(j => 
        j.client?.toString() === reviewer._id.toString() && 
        j.freelancer?.toString() === freelancer._id.toString()
      );
      if (!job) job = jobs[Math.floor(Math.random() * jobs.length)];
      if (!job) continue;

      // Skip if this exact reviewer+freelancer+job combo exists
      const reviewKey = `${pairKey}-${job._id}`;
      if (usedPairs.has(reviewKey)) continue;
      usedPairs.add(reviewKey);

      const template = reviewTemplates[Math.floor(Math.random() * reviewTemplates.length)];
      
      // Randomize the date (last 90 days)
      const daysAgo = Math.floor(Math.random() * 90);
      const reviewDate = new Date(Date.now() - daysAgo * 86400000);

      try {
        await Review.create({
          job: job._id,
          reviewer: reviewer._id,
          reviewee: freelancer._id,
          reviewerType: 'client',
          rating: template.rating,
          title: template.title,
          comment: template.comment,
          categories: template.cats,
          isPublic: true,
          isVerified: true,
          verifiedAt: reviewDate,
          moderationStatus: 'approved',
          createdAt: reviewDate,
          updatedAt: reviewDate,
        });
        created++;
        console.log(`  ✅ ${reviewer.firstName} → ${freelancer.firstName}: ${template.rating}⭐ "${template.title}"`);
      } catch (err) {
        if (err.code === 11000) continue; // duplicate
        console.error(`  ❌ Error:`, err.message);
      }
    }

    // Update freelancer's rating
    const stats = await Review.aggregate([
      { $match: { reviewee: freelancer._id, isPublic: true, moderationStatus: 'approved' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    if (stats[0]) {
      await User.findByIdAndUpdate(freelancer._id, {
        rating: Math.round(stats[0].avg * 10) / 10,
        totalReviews: stats[0].count,
        completedJobs: Math.max(stats[0].count, freelancer.completedJobs || 0)
      });
      console.log(`  📊 ${freelancer.firstName}: ${stats[0].avg.toFixed(1)}⭐ (${stats[0].count} reviews)`);
    }
  }

  console.log(`\n✅ Done! Created ${created} reviews for ${freelancers.length} freelancers`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
