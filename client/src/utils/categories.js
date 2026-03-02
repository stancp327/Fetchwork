/**
 * Fetchwork Categories — Frontend Config
 * Mirrors server/config/categories.js
 * Single source of truth for the frontend
 */

export const CATEGORIES = [
  // ─── Digital / Remote ───
  { id: 'web_development', label: 'Web Development', type: 'remote', icon: '💻' },
  { id: 'mobile_development', label: 'Mobile Development', type: 'remote', icon: '📱' },
  { id: 'design', label: 'Design', type: 'remote', icon: '🎨' },
  { id: 'writing', label: 'Writing', type: 'remote', icon: '✍️' },
  { id: 'marketing', label: 'Marketing', type: 'remote', icon: '📈' },
  { id: 'video_editing', label: 'Video & Animation', type: 'remote', icon: '🎬' },
  { id: 'music_audio', label: 'Music & Audio', type: 'remote', icon: '🎵' },
  { id: 'data_entry', label: 'Data & Research', type: 'remote', icon: '📊' },
  { id: 'virtual_assistant', label: 'Virtual Assistant', type: 'remote', icon: '🎧' },
  { id: 'customer_service', label: 'Customer Service', type: 'remote', icon: '📞' },
  { id: 'translation', label: 'Translation', type: 'remote', icon: '🌍' },
  { id: 'consulting', label: 'Consulting', type: 'remote', icon: '💼' },
  { id: 'tutoring', label: 'Tutoring & Lessons', type: 'both', icon: '📚' },

  // ─── Local / Physical ───
  { id: 'home_repair', label: 'Home Repair', type: 'local', icon: '🔧' },
  { id: 'cleaning', label: 'Cleaning', type: 'local', icon: '✨' },
  { id: 'moving_hauling', label: 'Moving & Hauling', type: 'local', icon: '🚚' },
  { id: 'landscaping', label: 'Landscaping & Yard', type: 'local', icon: '🌿' },
  { id: 'delivery', label: 'Delivery & Errands', type: 'local', icon: '📦' },
  { id: 'assembly', label: 'Assembly & Installation', type: 'local', icon: '🔩' },
  { id: 'auto_services', label: 'Auto Services', type: 'local', icon: '🚗' },
  { id: 'pet_care', label: 'Pet Care', type: 'local', icon: '🐕' },
  { id: 'event_help', label: 'Event Help', type: 'local', icon: '🎉' },
  { id: 'personal_care', label: 'Personal Care', type: 'local', icon: '💇' },
  { id: 'photography', label: 'Photography', type: 'local', icon: '📷' },

  // ── Classes ───
  { id: 'cooking_classes', label: 'Cooking Classes', type: 'both', icon: '👨‍🍳' },
  { id: 'fitness_classes', label: 'Fitness & Training', type: 'both', icon: '💪' },
  { id: 'art_classes', label: 'Art & Crafts', type: 'both', icon: '🎨' },
  { id: 'music_lessons', label: 'Music Lessons', type: 'both', icon: '🎵' },
  { id: 'language_classes', label: 'Language Classes', type: 'both', icon: '🗣️' },
  { id: 'dance_classes', label: 'Dance Classes', type: 'both', icon: '💃' },
  { id: 'tech_workshops', label: 'Tech Workshops', type: 'both', icon: '💻' },
  { id: 'yoga_meditation', label: 'Yoga & Meditation', type: 'both', icon: '🧘' },

  { id: 'other', label: 'Other', type: 'both', icon: '📋' },
];

// For <select> / <option> dropdowns
export const categoryOptions = CATEGORIES.map(c => ({
  value: c.id,
  label: `${c.icon} ${c.label}`
}));

// Lookup helpers
export const getCategoryLabel = (id) => {
  const cat = CATEGORIES.find(c => c.id === id);
  return cat ? cat.label : id?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
};

export const getCategoryIcon = (id) => {
  const cat = CATEGORIES.find(c => c.id === id);
  return cat ? cat.icon : '📋';
};

// Category label map (for components that use object lookups)
export const categoryLabelMap = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c.label])
);

// Grouped for UI sections
export const remoteCategories = CATEGORIES.filter(c => c.type === 'remote' || c.type === 'both');
export const localCategories = CATEGORIES.filter(c => c.type === 'local' || c.type === 'both');
