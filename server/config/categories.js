/**
 * Fetchwork Categories — Single Source of Truth
 * Used by Service, Job, and User models + frontend
 */

const CATEGORIES = [
  // ─── Digital / Remote ───
  {
    id: 'web_development',
    label: 'Web Development',
    type: 'remote',
    icon: 'code',
    subcategories: ['Frontend', 'Backend', 'Full Stack', 'WordPress', 'Shopify', 'E-commerce', 'Landing Pages']
  },
  {
    id: 'mobile_development',
    label: 'Mobile Development',
    type: 'remote',
    icon: 'smartphone',
    subcategories: ['iOS', 'Android', 'React Native', 'Flutter', 'Cross-Platform']
  },
  {
    id: 'design',
    label: 'Design',
    type: 'remote',
    icon: 'palette',
    subcategories: ['Graphic Design', 'UI/UX', 'Logo', 'Brand Identity', 'Illustration', 'Print Design']
  },
  {
    id: 'writing',
    label: 'Writing',
    type: 'remote',
    icon: 'edit',
    subcategories: ['Copywriting', 'Blog/SEO', 'Technical Writing', 'Ghostwriting', 'Editing/Proofreading', 'Resume Writing']
  },
  {
    id: 'marketing',
    label: 'Marketing',
    type: 'remote',
    icon: 'trending-up',
    subcategories: ['Social Media', 'SEO', 'Email Marketing', 'PPC/Ads', 'Influencer', 'Content Strategy']
  },
  {
    id: 'video_editing',
    label: 'Video & Animation',
    type: 'remote',
    icon: 'film',
    subcategories: ['YouTube Editing', 'Commercials', 'Animation', 'Motion Graphics', 'Color Grading']
  },
  {
    id: 'music_audio',
    label: 'Music & Audio',
    type: 'remote',
    icon: 'music',
    subcategories: ['Voiceover', 'Podcasting', 'Music Production', 'Mixing/Mastering', 'Sound Effects']
  },
  {
    id: 'data_entry',
    label: 'Data & Research',
    type: 'remote',
    icon: 'database',
    subcategories: ['Data Entry', 'Transcription', 'Spreadsheets', 'Web Research', 'Data Scraping']
  },
  {
    id: 'virtual_assistant',
    label: 'Virtual Assistant',
    type: 'remote',
    icon: 'headphones',
    subcategories: ['Admin Support', 'Scheduling', 'Customer Service', 'Bookkeeping', 'Email Management']
  },
  {
    id: 'translation',
    label: 'Translation',
    type: 'remote',
    icon: 'globe',
    subcategories: ['Document Translation', 'Website Localization', 'Subtitles', 'Interpretation']
  },
  {
    id: 'consulting',
    label: 'Consulting',
    type: 'remote',
    icon: 'briefcase',
    subcategories: ['Business', 'Legal', 'Financial', 'Career Coaching', 'IT Consulting']
  },
  {
    id: 'tutoring',
    label: 'Tutoring & Lessons',
    type: 'both',
    icon: 'book-open',
    subcategories: ['Academic', 'Test Prep', 'Language Lessons', 'Music Lessons', 'Coding Lessons']
  },

  // ─── Local / Physical ───
  {
    id: 'home_repair',
    label: 'Home Repair',
    type: 'local',
    icon: 'tool',
    subcategories: ['Handyman', 'Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Drywall', 'Roofing']
  },
  {
    id: 'cleaning',
    label: 'Cleaning',
    type: 'local',
    icon: 'sparkles',
    subcategories: ['House Cleaning', 'Deep Clean', 'Move-In/Out', 'Window Cleaning', 'Carpet Cleaning', 'Office Cleaning']
  },
  {
    id: 'moving_hauling',
    label: 'Moving & Hauling',
    type: 'local',
    icon: 'truck',
    subcategories: ['Local Moving', 'Furniture Moving', 'Junk Removal', 'Packing/Unpacking', 'Storage']
  },
  {
    id: 'landscaping',
    label: 'Landscaping & Yard',
    type: 'local',
    icon: 'sun',
    subcategories: ['Lawn Care', 'Gardening', 'Tree Trimming', 'Snow Removal', 'Irrigation', 'Hardscaping']
  },
  {
    id: 'delivery',
    label: 'Delivery & Errands',
    type: 'local',
    icon: 'package',
    subcategories: ['Grocery Delivery', 'Package Delivery', 'Furniture Delivery', 'Courier', 'Errands']
  },
  {
    id: 'assembly',
    label: 'Assembly & Installation',
    type: 'local',
    icon: 'wrench',
    subcategories: ['Furniture Assembly', 'IKEA Assembly', 'Shelving', 'TV Mounting', 'Equipment Setup']
  },
  {
    id: 'auto_services',
    label: 'Auto Services',
    type: 'local',
    icon: 'car',
    subcategories: ['Detailing', 'Oil Change', 'Tire Service', 'Mobile Mechanic', 'Car Wash']
  },
  {
    id: 'pet_care',
    label: 'Pet Care',
    type: 'local',
    icon: 'heart',
    subcategories: ['Dog Walking', 'Pet Sitting', 'Grooming', 'Training', 'Vet Visits']
  },
  {
    id: 'event_help',
    label: 'Event Help',
    type: 'local',
    icon: 'calendar',
    subcategories: ['Setup/Teardown', 'Catering Staff', 'Bartending', 'DJ', 'Photography', 'Coordination']
  },
  {
    id: 'personal_care',
    label: 'Personal Care',
    type: 'local',
    icon: 'user',
    subcategories: ['Hair Styling', 'Makeup', 'Massage', 'Personal Training', 'Nutrition']
  },
  {
    id: 'photography_local',
    label: 'Photography (Local)',
    type: 'local',
    icon: 'camera',
    subcategories: ['Portraits', 'Events', 'Real Estate', 'Product Photography', 'Headshots']
  },
  {
    id: 'other',
    label: 'Other',
    type: 'both',
    icon: 'more-horizontal',
    subcategories: ['Odd Jobs', 'General Labor', 'Waiting in Line', 'Custom Request']
  }
];

// Enum list for mongoose schema validation
const categoryEnum = CATEGORIES.map(c => c.id);

// Quick lookups
const getCategoryById = (id) => CATEGORIES.find(c => c.id === id);
const getRemoteCategories = () => CATEGORIES.filter(c => c.type === 'remote' || c.type === 'both');
const getLocalCategories = () => CATEGORIES.filter(c => c.type === 'local' || c.type === 'both');

module.exports = {
  CATEGORIES,
  categoryEnum,
  getCategoryById,
  getRemoteCategories,
  getLocalCategories
};
