
// Global types will be defined here as needed
export interface Category {
  id: number;
  name: string;
  slug: string;
  icon_name: string | null;
  parent_id: number | null;
  level: number;
  sort_order: number;
}

export interface State {
  id: number;
  name: string;
  region?: string;
  is_popular?: boolean;
}

export interface Business {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string;
  verification_tier: 'basic' | 'verified' | 'premium';
  verification_status: 'pending' | 'approved' | 'rejected' | 'none';
  state_id: number | null;
  city: string | null;
  address: string | null;
  whatsapp_number: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id: number;
  state_id: number;
  title: string;
  description: string;
  price: number;
  original_price?: number;
  condition: 'new' | 'used' | 'refurbished';
  images: string[];
  city?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// Extended type for UI with joined relations
export interface ProductWithRelations extends Product {
  businesses?: {
    user_id: string;
    business_name: string;
    verification_tier: 'basic' | 'verified' | 'premium';
  };
  states?: {
    name: string;
  };
  categories?: {
    name: string;
  };
}

export type MembershipTier = 'free' | 'pro' | 'business';

export interface Membership {
    user_id: string;
    plan: MembershipTier;
    status: 'active' | 'inactive';
    current_period_end: string | null;
}

export interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    state_id?: number | null;
    avatar_url: string | null;
    role?: 'buyer' | 'seller' | 'admin';
    membership_tier?: MembershipTier;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  product_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatParticipant {
    id: string;
    name: string;
    avatar?: string;
}

// Institution Tools Types
export interface Institution {
  id: string;
  user_id: string;
  org_name: string;
  org_type: string;
  address?: string;
  created_at: string;
}

export interface ProcurementLog {
  id: string;
  institution_id: string;
  product_id?: string;
  custom_item_name: string;
  quantity: number;
  unit_price: number;
  status: 'planned' | 'purchased';
  purchase_date?: string;
  created_at: string;
  products?: {
     title: string;
     images: string[];
  };
}

export interface ViolationLog {
  id: string;
  user_id: string;
  type: string;
  original_content: string;
  context: string;
  created_at: string;
  users?: {
      full_name: string;
      email: string;
  };
}
