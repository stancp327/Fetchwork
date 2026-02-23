/**
 * Seed script: 15 users (mix of clients/freelancers/both), 15 jobs, 15 services
 * Usage: MONGO_URI=<uri> node server/scripts/seed-test-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI;

async function seed() {
  if (!MONGO_URI) { console.error('MONGO_URI required'); process.exit(1); }
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const User = require('../models/User');
  const Job = require('../models/Job');
  const Service = require('../models/Service');

  const hashedPassword = await bcrypt.hash('TestPass123!', 10);

  // ── 15 Users ──────────────────────────────────────────────────
  const usersData = [
    { firstName: 'Sarah', lastName: 'Chen', email: 'sarah.chen@test.com', accountType: 'freelancer', bio: 'Full-stack developer with 5 years of React and Node.js experience. I build clean, scalable web apps.', skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'], hourlyRate: 85, location: { locationType: 'remote', city: '', state: '', zipCode: '' }, headline: 'Senior Full-Stack Developer' },
    { firstName: 'Marcus', lastName: 'Johnson', email: 'marcus.j@test.com', accountType: 'freelancer', bio: 'Professional graphic designer specializing in brand identity, logos, and marketing materials.', skills: ['Photoshop', 'Illustrator', 'Figma', 'Brand Design', 'UI/UX'], hourlyRate: 65, location: { locationType: 'remote', city: '', state: '', zipCode: '' }, headline: 'Brand & Visual Designer' },
    { firstName: 'Elena', lastName: 'Rodriguez', email: 'elena.r@test.com', accountType: 'freelancer', bio: 'Licensed handyman serving the Bay Area. Plumbing, electrical, drywall, painting — you name it.', skills: ['Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Drywall'], hourlyRate: 55, location: { locationType: 'local', city: 'Oakland', state: 'CA', zipCode: '94612' }, headline: 'Licensed Handyman — Bay Area' },
    { firstName: 'James', lastName: 'Kim', email: 'james.kim@test.com', accountType: 'both', bio: 'Mobile app developer and occasional client. I build iOS/Android apps with React Native and Flutter.', skills: ['React Native', 'Flutter', 'Swift', 'Firebase', 'REST APIs'], hourlyRate: 95, location: { locationType: 'remote', city: 'San Francisco', state: 'CA', zipCode: '94105' }, headline: 'Mobile App Developer' },
    { firstName: 'Priya', lastName: 'Patel', email: 'priya.p@test.com', accountType: 'freelancer', bio: 'SEO and content marketing specialist. I help businesses grow their organic traffic and conversions.', skills: ['SEO', 'Content Strategy', 'Google Analytics', 'Copywriting', 'Email Marketing'], hourlyRate: 70, location: { locationType: 'remote', city: '', state: '', zipCode: '' }, headline: 'SEO & Content Marketing Expert' },
    { firstName: 'David', lastName: 'Thompson', email: 'david.t@test.com', accountType: 'client', bio: 'Small business owner looking for talented freelancers to help grow my e-commerce brand.', skills: [], hourlyRate: 0, location: { locationType: 'local', city: 'Concord', state: 'CA', zipCode: '94520' }, headline: 'E-Commerce Business Owner' },
    { firstName: 'Aisha', lastName: 'Williams', email: 'aisha.w@test.com', accountType: 'freelancer', bio: 'Professional house cleaner with 8 years experience. Deep cleans, move-in/out, regular maintenance.', skills: ['Deep Cleaning', 'Move-In/Out', 'Office Cleaning', 'Window Cleaning'], hourlyRate: 40, location: { locationType: 'local', city: 'Walnut Creek', state: 'CA', zipCode: '94596' }, headline: 'Professional Cleaning Services' },
    { firstName: 'Ryan', lastName: 'O\'Brien', email: 'ryan.ob@test.com', accountType: 'both', bio: 'Video editor and motion graphics artist. YouTube, commercials, social media — I do it all.', skills: ['Premiere Pro', 'After Effects', 'DaVinci Resolve', 'Motion Graphics', 'Color Grading'], hourlyRate: 75, location: { locationType: 'remote', city: '', state: '', zipCode: '' }, headline: 'Video Editor & Motion Designer' },
    { firstName: 'Lisa', lastName: 'Nguyen', email: 'lisa.n@test.com', accountType: 'client', bio: 'Restaurant owner looking for help with website, marketing, and occasional event staffing.', skills: [], hourlyRate: 0, location: { locationType: 'local', city: 'Pleasant Hill', state: 'CA', zipCode: '94523' }, headline: 'Restaurant Owner' },
    { firstName: 'Carlos', lastName: 'Mendez', email: 'carlos.m@test.com', accountType: 'freelancer', bio: 'Professional mover and hauler. Local moves, furniture delivery, junk removal. Licensed and insured.', skills: ['Local Moving', 'Furniture Moving', 'Junk Removal', 'Packing', 'Heavy Lifting'], hourlyRate: 45, location: { locationType: 'local', city: 'Martinez', state: 'CA', zipCode: '94553' }, headline: 'Professional Mover — East Bay' },
    { firstName: 'Hannah', lastName: 'Foster', email: 'hannah.f@test.com', accountType: 'freelancer', bio: 'Freelance writer and editor. Blog posts, website copy, technical documentation, and ghostwriting.', skills: ['Blog Writing', 'Copywriting', 'Technical Writing', 'Editing', 'SEO Writing'], hourlyRate: 55, location: { locationType: 'remote', city: '', state: '', zipCode: '' }, headline: 'Freelance Writer & Editor' },
    { firstName: 'Derek', lastName: 'Washington', email: 'derek.w@test.com', accountType: 'client', bio: 'Startup founder building a SaaS platform. Need developers, designers, and marketers.', skills: [], hourlyRate: 0, location: { locationType: 'remote', city: 'San Jose', state: 'CA', zipCode: '95113' }, headline: 'SaaS Startup Founder' },
    { firstName: 'Mia', lastName: 'Chang', email: 'mia.c@test.com', accountType: 'freelancer', bio: 'Event photographer and portrait specialist. Weddings, corporate events, headshots, and real estate.', skills: ['Portrait Photography', 'Event Photography', 'Photo Editing', 'Lightroom', 'Real Estate Photography'], hourlyRate: 80, location: { locationType: 'local', city: 'Berkeley', state: 'CA', zipCode: '94704' }, headline: 'Professional Photographer — Bay Area' },
    { firstName: 'Alex', lastName: 'Turner', email: 'alex.t@test.com', accountType: 'both', bio: 'Dog walker and pet sitter by day, aspiring app developer by night. Based in Concord.', skills: ['Dog Walking', 'Pet Sitting', 'Basic Grooming', 'Pet First Aid'], hourlyRate: 25, location: { locationType: 'local', city: 'Concord', state: 'CA', zipCode: '94520' }, headline: 'Pet Care Professional' },
    { firstName: 'Nicole', lastName: 'Baker', email: 'nicole.b@test.com', accountType: 'client', bio: 'Real estate agent looking for photographers, cleaners, handymen, and virtual assistants.', skills: [], hourlyRate: 0, location: { locationType: 'local', city: 'Danville', state: 'CA', zipCode: '94526' }, headline: 'Real Estate Agent' },
  ];

  const users = [];
  for (const u of usersData) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`  Skipping user ${u.email} (already exists)`);
      users.push(existing);
      continue;
    }
    const user = new User({
      ...u,
      password: hashedPassword,
      isActive: true,
      isSuspended: false,
      isVerified: true,
      emailVerified: true,
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      totalReviews: Math.floor(Math.random() * 30) + 1,
      completedJobs: Math.floor(Math.random() * 25),
      totalEarnings: Math.floor(Math.random() * 15000),
    });
    await user.save();
    users.push(user);
    console.log(`  Created user: ${u.firstName} ${u.lastName} (${u.accountType})`);
  }

  // Helper to get user by email
  const byEmail = (email) => users.find(u => u.email === email);

  // ── 15 Jobs ───────────────────────────────────────────────────
  const jobsData = [
    { title: 'Build a React E-Commerce Dashboard', client: 'david.t@test.com', category: 'web_development', description: 'Need a modern React dashboard for my e-commerce store. Should display sales analytics, inventory management, customer data, and order tracking. Must be responsive and connect to our existing REST API.', budget: { type: 'fixed', amount: 3500, currency: 'USD' }, duration: '2_3_months', experienceLevel: 'intermediate', skills: ['React', 'TypeScript', 'REST API', 'Chart.js'], location: { locationType: 'remote' }, deadline: new Date('2026-04-15') },
    { title: 'Logo and Brand Identity for New Restaurant', client: 'lisa.n@test.com', category: 'design', description: 'Opening a new Asian fusion restaurant and need complete brand identity. Logo, color palette, menu design, business cards, and social media templates. Looking for something modern but warm.', budget: { type: 'fixed', amount: 1200, currency: 'USD' }, duration: '1_2_weeks', experienceLevel: 'intermediate', skills: ['Logo Design', 'Brand Identity', 'Illustrator', 'Menu Design'], location: { locationType: 'remote' }, deadline: new Date('2026-03-15') },
    { title: 'Fix Leaking Kitchen Faucet + Install Garbage Disposal', client: 'nicole.b@test.com', category: 'home_repair', description: 'Kitchen faucet has been leaking for a week. Also need a new garbage disposal installed (already purchased, just need installation). House is in Danville.', budget: { type: 'fixed', amount: 250, currency: 'USD' }, duration: 'less_than_1_week', experienceLevel: 'entry', skills: ['Plumbing', 'Installation'], location: { locationType: 'local', city: 'Danville', state: 'CA', zipCode: '94526' }, isUrgent: true },
    { title: 'SEO Audit and Content Strategy for SaaS Website', client: 'derek.w@test.com', category: 'marketing', description: 'Our SaaS website is barely ranking. Need a comprehensive SEO audit, keyword research, and a 3-month content plan. We have a blog but no strategy.', budget: { type: 'fixed', amount: 2000, currency: 'USD' }, duration: '1_month', experienceLevel: 'expert', skills: ['SEO', 'Content Strategy', 'Google Analytics', 'Keyword Research'], location: { locationType: 'remote' } },
    { title: 'Deep Clean 4-Bedroom House (Move-Out)', client: 'nicole.b@test.com', category: 'cleaning', description: 'Listing a property and need a thorough move-out deep clean. 4 bedrooms, 3 bathrooms, kitchen, living areas. Must be spotless for showings. Property in Walnut Creek.', budget: { type: 'fixed', amount: 400, currency: 'USD' }, duration: 'less_than_1_week', experienceLevel: 'entry', skills: ['Deep Cleaning', 'Move-Out Cleaning'], location: { locationType: 'local', city: 'Walnut Creek', state: 'CA', zipCode: '94596' }, deadline: new Date('2026-03-01') },
    { title: 'iOS and Android App for Local Delivery Service', client: 'david.t@test.com', category: 'mobile_development', description: 'Building a local delivery service app. Need both iOS and Android versions. Features: user ordering, driver tracking, payment processing, push notifications. React Native preferred.', budget: { type: 'fixed', amount: 8000, currency: 'USD' }, duration: '3_6_months', experienceLevel: 'expert', skills: ['React Native', 'Firebase', 'Stripe', 'Push Notifications', 'Maps API'], location: { locationType: 'remote' }, deadline: new Date('2026-06-01') },
    { title: 'Write 10 Blog Posts on Personal Finance', client: 'derek.w@test.com', category: 'writing', description: 'Need 10 well-researched blog posts (1500-2000 words each) on personal finance topics. SEO-optimized, engaging tone, cited sources. Topics include budgeting, investing, debt payoff, and side hustles.', budget: { type: 'fixed', amount: 1500, currency: 'USD' }, duration: '1_month', experienceLevel: 'intermediate', skills: ['Blog Writing', 'SEO Writing', 'Research', 'Finance Knowledge'], location: { locationType: 'remote' } },
    { title: 'Help Moving Furniture to New Office', client: 'lisa.n@test.com', category: 'moving_hauling', description: 'Moving restaurant furniture from storage to our new location in Pleasant Hill. About 15 items including tables, chairs, a bar counter, and kitchen equipment. Need 2 people, truck helpful but not required.', budget: { type: 'fixed', amount: 350, currency: 'USD' }, duration: 'less_than_1_week', experienceLevel: 'entry', skills: ['Furniture Moving', 'Heavy Lifting'], location: { locationType: 'local', city: 'Pleasant Hill', state: 'CA', zipCode: '94523' }, deadline: new Date('2026-03-05'), isUrgent: true },
    { title: 'Wedding Photography — April 2026', client: 'nicole.b@test.com', category: 'photography', description: 'Looking for a photographer for a small outdoor wedding in Berkeley. About 50 guests, ceremony + reception. Need 4-5 hours coverage, edited photos delivered within 2 weeks.', budget: { type: 'fixed', amount: 1800, currency: 'USD' }, duration: '1_2_weeks', experienceLevel: 'intermediate', skills: ['Wedding Photography', 'Photo Editing', 'Portrait Photography'], location: { locationType: 'local', city: 'Berkeley', state: 'CA', zipCode: '94704' }, deadline: new Date('2026-04-20') },
    { title: 'Virtual Assistant for Email & Calendar Management', client: 'derek.w@test.com', category: 'virtual_assistant', description: 'Need a part-time VA (10-15 hours/week) to manage my inbox, schedule meetings, handle customer inquiries, and do basic data entry. Must be organized and responsive.', budget: { type: 'hourly', amount: 20, currency: 'USD' }, duration: '3_6_months', experienceLevel: 'entry', skills: ['Email Management', 'Google Calendar', 'Customer Service', 'Data Entry'], location: { locationType: 'remote' } },
    { title: 'YouTube Channel Video Editing (Ongoing)', client: 'james.kim@test.com', category: 'video_editing', description: 'Looking for a video editor for my tech review YouTube channel. 2 videos per week, each about 10-15 minutes. Need cuts, transitions, text overlays, thumbnail creation, and color correction.', budget: { type: 'fixed', amount: 200, currency: 'USD' }, duration: 'more_than_6_months', experienceLevel: 'intermediate', skills: ['Premiere Pro', 'After Effects', 'Thumbnail Design', 'YouTube'], location: { locationType: 'remote' } },
    { title: 'Dog Walking — Weekdays 12-1pm', client: 'david.t@test.com', category: 'pet_care', description: 'Need a reliable dog walker for my two golden retrievers, Monday-Friday around lunchtime. 30-minute walk in the Concord area. Must be comfortable with large dogs.', budget: { type: 'hourly', amount: 20, currency: 'USD' }, duration: 'more_than_6_months', experienceLevel: 'entry', skills: ['Dog Walking', 'Large Dogs'], location: { locationType: 'local', city: 'Concord', state: 'CA', zipCode: '94520' } },
    { title: 'Assemble IKEA Furniture (5 pieces)', client: 'lisa.n@test.com', category: 'assembly', description: 'Just got delivery of IKEA furniture for the restaurant office. Need assembled: 2 KALLAX shelving units, 1 BEKANT desk, 1 MALM dresser, and 1 PAX wardrobe. All pieces and tools on-site.', budget: { type: 'fixed', amount: 200, currency: 'USD' }, duration: 'less_than_1_week', experienceLevel: 'entry', skills: ['Furniture Assembly', 'IKEA'], location: { locationType: 'local', city: 'Pleasant Hill', state: 'CA', zipCode: '94523' } },
    { title: 'Spanish to English Document Translation (Legal)', client: 'nicole.b@test.com', category: 'translation', description: 'Need 25 pages of legal documents translated from Spanish to English. Must be accurate and professional — these are property-related legal documents. Certified translator preferred.', budget: { type: 'fixed', amount: 600, currency: 'USD' }, duration: '1_2_weeks', experienceLevel: 'expert', skills: ['Spanish', 'English', 'Legal Translation', 'Certified Translator'], location: { locationType: 'remote' }, deadline: new Date('2026-03-10') },
    { title: 'Lawn Care + Garden Cleanup — Monthly', client: 'nicole.b@test.com', category: 'landscaping', description: 'Looking for someone to do monthly lawn maintenance at a rental property in Danville. Mow, edge, blow, basic weed pulling, and seasonal garden cleanup. About 0.25 acre lot.', budget: { type: 'fixed', amount: 150, currency: 'USD' }, duration: 'more_than_6_months', experienceLevel: 'entry', skills: ['Lawn Mowing', 'Edging', 'Weed Removal', 'Garden Cleanup'], location: { locationType: 'local', city: 'Danville', state: 'CA', zipCode: '94526' } },
  ];

  for (const j of jobsData) {
    const client = byEmail(j.client);
    const existing = await Job.findOne({ title: j.title, client: client._id });
    if (existing) {
      console.log(`  Skipping job: ${j.title} (exists)`);
      continue;
    }
    const job = new Job({
      ...j,
      client: client._id,
      status: 'open',
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      views: Math.floor(Math.random() * 60) + 5,
      location: {
        locationType: j.location.locationType,
        city: j.location.city || '',
        state: j.location.state || '',
        zipCode: j.location.zipCode || '',
        address: j.location.city ? `${j.location.city}, ${j.location.state}` : '',
        coordinates: { type: 'Point', coordinates: [0, 0] },
        serviceRadius: 25
      }
    });
    await job.save();
    console.log(`  Created job: ${j.title}`);
  }

  // ── 15 Services ───────────────────────────────────────────────
  const servicesData = [
    { title: 'Custom React Web Application Development', freelancer: 'sarah.chen@test.com', category: 'web_development', description: 'I will build a custom React web application tailored to your business needs. Clean code, responsive design, REST API integration, and deployment included.', skills: ['React', 'Node.js', 'TypeScript'], pricing: { basic: { title: 'Landing Page', price: 500, deliveryTime: 7, description: 'Single responsive landing page with contact form', revisions: 2 }, standard: { title: 'Multi-Page App', price: 1500, deliveryTime: 14, description: 'Up to 5 pages with API integration and auth', revisions: 3 }, premium: { title: 'Full Stack App', price: 4000, deliveryTime: 30, description: 'Complete web app with dashboard, auth, payments, and deployment', revisions: 5 } }, location: { locationType: 'remote' } },
    { title: 'Professional Logo & Brand Identity Design', freelancer: 'marcus.j@test.com', category: 'design', description: 'Stand out with a unique brand identity. I create memorable logos, choose perfect color palettes, and design brand guidelines that tell your story.', skills: ['Logo Design', 'Brand Identity', 'Illustrator'], pricing: { basic: { title: 'Logo Only', price: 200, deliveryTime: 3, description: 'Logo design with 3 concepts and 2 revisions', revisions: 2 }, standard: { title: 'Logo + Brand Kit', price: 500, deliveryTime: 7, description: 'Logo + color palette + typography + brand guidelines', revisions: 3 }, premium: { title: 'Full Brand Identity', price: 1200, deliveryTime: 14, description: 'Logo + brand kit + business cards + social templates + letterhead', revisions: 5 } }, location: { locationType: 'remote' } },
    { title: 'Handyman Services — Bay Area', freelancer: 'elena.r@test.com', category: 'home_repair', description: 'Licensed handyman serving Oakland, Berkeley, Concord, and surrounding areas. Plumbing, electrical, drywall, painting, fixtures, and general repairs. Free estimates.', skills: ['Plumbing', 'Electrical', 'Carpentry'], pricing: { basic: { title: 'Small Repair', price: 100, deliveryTime: 1, description: 'Single small repair (faucet, light fixture, patch hole)', revisions: 1 }, standard: { title: 'Half-Day Service', price: 250, deliveryTime: 1, description: '4 hours of handyman work — multiple repairs', revisions: 1 }, premium: { title: 'Full-Day Service', price: 450, deliveryTime: 1, description: '8 hours of handyman work — bigger projects', revisions: 1 } }, location: { locationType: 'local', city: 'Oakland', state: 'CA', zipCode: '94612' } },
    { title: 'iOS & Android Mobile App Development', freelancer: 'james.kim@test.com', category: 'mobile_development', description: 'Full-service mobile app development using React Native. One codebase, both platforms. I handle design implementation, API integration, app store submission, and post-launch support.', skills: ['React Native', 'Firebase', 'Swift'], pricing: { basic: { title: 'App Prototype', price: 1000, deliveryTime: 14, description: 'Interactive prototype with 5 screens', revisions: 2 }, standard: { title: 'MVP App', price: 4000, deliveryTime: 30, description: 'Working app with auth, API, and core features', revisions: 3 }, premium: { title: 'Full App', price: 8000, deliveryTime: 60, description: 'Production-ready app with payments, push, analytics, and store submission', revisions: 5 } }, location: { locationType: 'remote' } },
    { title: 'SEO Audit & Content Marketing Strategy', freelancer: 'priya.p@test.com', category: 'marketing', description: 'Boost your organic traffic with a data-driven SEO strategy. I audit your site, find keyword opportunities, and create a content plan that drives real results.', skills: ['SEO', 'Content Strategy', 'Google Analytics'], pricing: { basic: { title: 'SEO Audit', price: 300, deliveryTime: 5, description: 'Technical SEO audit with prioritized fix list', revisions: 1 }, standard: { title: 'Audit + Strategy', price: 800, deliveryTime: 10, description: 'SEO audit + keyword research + 3-month content plan', revisions: 2 }, premium: { title: 'Full Service', price: 2000, deliveryTime: 30, description: 'Audit + strategy + 8 SEO-optimized blog posts written', revisions: 3 } }, location: { locationType: 'remote' } },
    { title: 'Professional House Cleaning — East Bay', freelancer: 'aisha.w@test.com', category: 'cleaning', description: 'Spotless cleaning services in Walnut Creek, Concord, Pleasant Hill, and surrounding areas. Regular maintenance, deep cleans, and move-in/out cleaning.', skills: ['Deep Cleaning', 'Move-In/Out'], pricing: { basic: { title: 'Regular Clean', price: 120, deliveryTime: 1, description: 'Standard cleaning for 1-2 bedroom home', revisions: 1 }, standard: { title: 'Deep Clean', price: 250, deliveryTime: 1, description: 'Deep clean for 3-4 bedroom home — all surfaces', revisions: 1 }, premium: { title: 'Move-In/Out Clean', price: 400, deliveryTime: 1, description: 'Thorough move-in/out cleaning — walls, baseboards, appliances', revisions: 1 } }, location: { locationType: 'local', city: 'Walnut Creek', state: 'CA', zipCode: '94596' } },
    { title: 'YouTube Video Editing & Thumbnails', freelancer: 'ryan.ob@test.com', category: 'video_editing', description: 'Professional video editing for YouTubers and content creators. Cuts, transitions, sound mixing, motion graphics, and eye-catching thumbnails. Fast turnaround.', skills: ['Premiere Pro', 'After Effects', 'Thumbnails'], pricing: { basic: { title: 'Basic Edit', price: 50, deliveryTime: 2, description: 'Clean cuts, basic transitions, music for up to 10 min video', revisions: 1 }, standard: { title: 'Standard Edit', price: 100, deliveryTime: 3, description: 'Full edit with effects, text overlays, sound mixing + thumbnail', revisions: 2 }, premium: { title: 'Premium Edit', price: 200, deliveryTime: 5, description: 'Full edit + motion graphics + color grading + 3 thumbnail options', revisions: 3 } }, location: { locationType: 'remote' } },
    { title: 'Local Moving & Hauling — East Bay', freelancer: 'carlos.m@test.com', category: 'moving_hauling', description: 'Need something moved? I handle local moves, furniture delivery, junk removal, and hauling in Concord, Martinez, Pleasant Hill, and nearby. Licensed and insured.', skills: ['Local Moving', 'Junk Removal'], pricing: { basic: { title: 'Small Load', price: 100, deliveryTime: 1, description: 'Small items — boxes, single furniture piece, appliance', revisions: 1 }, standard: { title: 'Half Move', price: 250, deliveryTime: 1, description: 'Half truck load — several furniture pieces or room move', revisions: 1 }, premium: { title: 'Full Move', price: 500, deliveryTime: 1, description: 'Full truck load — apartment or small house move', revisions: 1 } }, location: { locationType: 'local', city: 'Martinez', state: 'CA', zipCode: '94553' } },
    { title: 'Blog Writing & Content Creation', freelancer: 'hannah.f@test.com', category: 'writing', description: 'Engaging, SEO-friendly blog posts and web copy that connect with your audience and rank on Google. Any niche — tech, finance, health, lifestyle, B2B.', skills: ['Blog Writing', 'SEO Writing', 'Copywriting'], pricing: { basic: { title: '1 Blog Post', price: 80, deliveryTime: 3, description: '1000-word SEO blog post with research and images', revisions: 1 }, standard: { title: '4 Blog Posts', price: 280, deliveryTime: 10, description: 'Four 1000-word SEO blog posts — monthly package', revisions: 2 }, premium: { title: 'Content Package', price: 600, deliveryTime: 14, description: '4 blog posts + 2 landing pages + meta descriptions', revisions: 3 } }, location: { locationType: 'remote' } },
    { title: 'Event & Portrait Photography — Bay Area', freelancer: 'mia.c@test.com', category: 'photography', description: 'Capturing your special moments with a creative eye. Weddings, corporate events, portraits, headshots, and real estate photography in the Bay Area.', skills: ['Event Photography', 'Portraits', 'Lightroom'], pricing: { basic: { title: 'Mini Session', price: 150, deliveryTime: 5, description: '30-min portrait or headshot session — 10 edited photos', revisions: 1 }, standard: { title: 'Event Coverage', price: 500, deliveryTime: 7, description: '3-hour event coverage — 50+ edited photos', revisions: 2 }, premium: { title: 'Full Wedding', price: 2000, deliveryTime: 14, description: '6-hour wedding coverage — 200+ edited photos + online gallery', revisions: 3 } }, location: { locationType: 'local', city: 'Berkeley', state: 'CA', zipCode: '94704' } },
    { title: 'Dog Walking & Pet Sitting — Concord Area', freelancer: 'alex.t@test.com', category: 'pet_care', description: 'Reliable and caring dog walker and pet sitter in the Concord/Walnut Creek area. Daily walks, overnight sitting, and basic grooming available.', skills: ['Dog Walking', 'Pet Sitting'], pricing: { basic: { title: 'Daily Walk', price: 20, deliveryTime: 1, description: '30-minute dog walk — any size dog', revisions: 1 }, standard: { title: 'Weekly Walks', price: 80, deliveryTime: 7, description: '5 walks per week — M-F 30 min each', revisions: 1 }, premium: { title: 'Overnight Sitting', price: 60, deliveryTime: 1, description: 'Overnight pet sitting at your home — feeding, walks, companionship', revisions: 1 } }, location: { locationType: 'local', city: 'Concord', state: 'CA', zipCode: '94520' } },
    { title: 'Business Consulting & Strategy Sessions', freelancer: 'james.kim@test.com', category: 'consulting', description: 'Drawing from my experience as both a developer and entrepreneur, I help startups and small businesses with tech strategy, product planning, and growth tactics.', skills: ['Business Strategy', 'Product Planning', 'Tech Consulting'], pricing: { basic: { title: '1-Hour Call', price: 100, deliveryTime: 1, description: 'One-hour strategy call with follow-up notes', revisions: 1 }, standard: { title: 'Deep Dive', price: 500, deliveryTime: 7, description: '3 sessions + written strategy document', revisions: 2 }, premium: { title: 'Monthly Advisor', price: 1500, deliveryTime: 30, description: 'Weekly calls + ongoing Slack access + quarterly roadmap', revisions: 3 } }, location: { locationType: 'remote' } },
    { title: 'IKEA & Furniture Assembly — East Bay', freelancer: 'carlos.m@test.com', category: 'assembly', description: 'Hate reading IKEA instructions? I love it. Fast, careful furniture assembly for IKEA, Wayfair, Amazon, and more. Also do TV mounting and shelving installation.', skills: ['Furniture Assembly', 'IKEA', 'TV Mounting'], pricing: { basic: { title: '1 Piece', price: 40, deliveryTime: 1, description: 'Assemble 1 piece of furniture (basic complexity)', revisions: 1 }, standard: { title: '3 Pieces', price: 100, deliveryTime: 1, description: 'Assemble up to 3 pieces of furniture', revisions: 1 }, premium: { title: '5+ Pieces', price: 200, deliveryTime: 1, description: 'Assemble 5+ pieces — full room or office setup', revisions: 1 } }, location: { locationType: 'local', city: 'Martinez', state: 'CA', zipCode: '94553' } },
    { title: 'Math & Science Tutoring (K-12)', freelancer: 'sarah.chen@test.com', category: 'tutoring', description: 'Patient and experienced tutor for math and science, K-12. Can do in-person (Bay Area) or online via Zoom. SAT/ACT prep also available.', skills: ['Math Tutoring', 'Science Tutoring', 'SAT Prep'], pricing: { basic: { title: '1 Session', price: 50, deliveryTime: 1, description: '1-hour tutoring session via Zoom', revisions: 1 }, standard: { title: '4 Sessions', price: 180, deliveryTime: 7, description: 'Weekly sessions for 1 month — custom lesson plan', revisions: 1 }, premium: { title: 'SAT/ACT Prep', price: 500, deliveryTime: 30, description: '8 sessions + practice tests + study plan', revisions: 1 } }, location: { locationType: 'hybrid', city: 'San Francisco', state: 'CA', zipCode: '94105' } },
    { title: 'Lawn Care & Landscaping — East Bay', freelancer: 'elena.r@test.com', category: 'landscaping', description: 'Keep your yard looking great. Mowing, edging, blowing, weed removal, hedge trimming, and seasonal cleanups. Serving Oakland through Concord.', skills: ['Lawn Care', 'Hedging', 'Weed Removal'], pricing: { basic: { title: 'Basic Mow', price: 50, deliveryTime: 1, description: 'Mow, edge, and blow — standard lot', revisions: 1 }, standard: { title: 'Full Maintenance', price: 120, deliveryTime: 1, description: 'Mow + edge + blow + weed pull + hedge trim', revisions: 1 }, premium: { title: 'Seasonal Cleanup', price: 300, deliveryTime: 2, description: 'Full yard cleanup — pruning, debris removal, mulching, planting', revisions: 1 } }, location: { locationType: 'local', city: 'Oakland', state: 'CA', zipCode: '94612' } },
  ];

  for (const s of servicesData) {
    const freelancer = byEmail(s.freelancer);
    const existing = await Service.findOne({ title: s.title, freelancer: freelancer._id });
    if (existing) {
      console.log(`  Skipping service: ${s.title} (exists)`);
      continue;
    }
    const service = new Service({
      ...s,
      freelancer: freelancer._id,
      status: 'active',
      isActive: true,
      views: Math.floor(Math.random() * 40) + 5,
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      totalOrders: Math.floor(Math.random() * 15),
      location: {
        locationType: s.location.locationType,
        city: s.location.city || '',
        state: s.location.state || '',
        zipCode: s.location.zipCode || '',
        address: s.location.city ? `${s.location.city}, ${s.location.state}` : '',
        coordinates: { type: 'Point', coordinates: [0, 0] },
        serviceRadius: 25
      }
    });
    await service.save();
    console.log(`  Created service: ${s.title}`);
  }

  console.log('\n✅ Seeding complete!');
  console.log(`   ${users.length} users, ${jobsData.length} jobs, ${servicesData.length} services`);
  console.log('   All test user passwords: TestPass123!');
  await mongoose.disconnect();
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
