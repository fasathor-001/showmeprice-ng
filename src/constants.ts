
// Global constants will be defined here
export const APP_NAME = "ShowMePrice.ng";

export const POPULAR_STATES = [
  "Abuja (FCT)", 
  "Lagos", 
  "Ogun", 
  "Delta", 
  "Rivers", 
  "Anambra", 
  "Oyo", 
  "Edo", 
  "Kaduna", 
  "Abia"
];

export const OTHER_STATES = [
  "Adamawa", "Akwa Ibom", "Bauchi", "Bayelsa", "Benue", "Borno", 
  "Cross River", "Ebonyi", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa", 
  "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Nasarawa", "Niger", "Ondo", "Osun", 
  "Plateau", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

// Combined list for backward compatibility if needed
export const NIGERIAN_STATES = [
  ...POPULAR_STATES,
  ...OTHER_STATES
];

export const MOCK_CATEGORIES = [
  { id: 1, name: "Phones & Tablets", icon_name: "smartphone", slug: "phones-tablets", parent_id: null, level: 0, sort_order: 1 },
  { id: 2, name: "Electronics", icon_name: "tv", slug: "electronics", parent_id: null, level: 0, sort_order: 2 },
  { id: 3, name: "Computing", icon_name: "laptop", slug: "computing", parent_id: null, level: 0, sort_order: 3 },
  { id: 4, name: "Health & Beauty", icon_name: "heart", slug: "health-beauty", parent_id: null, level: 0, sort_order: 4 },
  { id: 5, name: "Fashion", icon_name: "shirt", slug: "fashion", parent_id: null, level: 0, sort_order: 5 },
  { id: 6, name: "Home & Office", icon_name: "home", slug: "home-office", parent_id: null, level: 0, sort_order: 6 },
  { id: 7, name: "Automobile", icon_name: "car", slug: "automobile", parent_id: null, level: 0, sort_order: 7 },
  { id: 8, name: "Gaming", icon_name: "gamepad-2", slug: "gaming", parent_id: null, level: 0, sort_order: 8 },
  { id: 9, name: "Real Estate", icon_name: "building-2", slug: "real-estate", parent_id: null, level: 0, sort_order: 9 },
  { id: 10, name: "Agriculture & Food", icon_name: "sprout", slug: "agriculture", parent_id: null, level: 0, sort_order: 10 },
  { id: 11, name: "Babies & Kids", icon_name: "baby", slug: "babies-kids", parent_id: null, level: 0, sort_order: 11 },
  { id: 12, name: "Pets & Animals", icon_name: "paw-print", slug: "pets", parent_id: null, level: 0, sort_order: 12 },
  { id: 13, name: "Commercial Equipment", icon_name: "hammer", slug: "commercial-equipment", parent_id: null, level: 0, sort_order: 13 },
  { id: 14, name: "Repair & Services", icon_name: "wrench", slug: "services", parent_id: null, level: 0, sort_order: 14 },
];

export const TIER_LIMITS = {
  free: 3,
  pro: 20,
  business: Infinity
};

export const ANTI_LEAK_PATTERNS = [
  // Phone numbers (Generic 11 digits, +234, etc)
  /\b(?:\+?234|0)?[789][01]\d{8}\b/g,
  /\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/g,
  // Emails
  /\b[\w.-]+@[\w.-]+\.\w{2,4}\b/g,
  // Social Handles (@username)
  /@\w+/g,
  // URLs / Links
  /(https?:\/\/[^\s]+)/g,
  /(www\.[^\s]+)/g,
  /\bwhatsapp\b/gi
];
