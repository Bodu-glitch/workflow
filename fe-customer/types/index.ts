export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  phone?: string | null;
  address?: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  keywords: string[];
}

export interface CategoryMatch {
  id: string;
  name: string;
  slug: string;
  score: number;
}

export interface ServiceRequest {
  id: string;
  customer_id: string;
  category_id: string | null;
  description: string;
  photo_urls: string[];
  location_name: string | null;
  location_address: string | null;
  location_lat: number;
  location_lng: number;
  status: RequestStatus;
  priority: 'normal' | 'urgent' | 'sos';
  is_emergency: boolean;
  scheduled_at: string | null;
  tenant_id: string | null;
  assigned_staff_id: string | null;
  agreed_price: number | null;
  requote_price: number | null;
  requote_reason: string | null;
  collected_amount: number | null;
  collected_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  // Joined fields
  category?: Category | null;
  tenant?: { id: string; name: string; slug: string } | null;
  staff?: StaffInfo | null;
  customer?: { id: string; full_name: string; avatar_url: string | null } | null;
}

export interface MatchingTenant {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  pricing: {
    id: string;
    service_name: string;
    price_min: number | null;
    price_max: number | null;
    price_fixed: number | null;
    currency: string;
    estimated_duration_minutes: number | null;
  };
}

export type RequestStatus =
  | 'unavailable'
  | 'available'
  | 'negotiating'
  | 'pending_assignment'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'completed_late'
  | 'cancelled';

export interface StaffInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone?: string | null;
  rating_avg: number | null;
  rating_count?: number;
}

export interface ChatMessage {
  id: string;
  request_id: string;
  user_id: string;
  channel: 'customer_operator' | 'customer_staff';
  content: string | null;
  media_urls: string[];
  is_system: boolean;
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export interface Pricing {
  id: string;
  tenant_id: string;
  category_id: string;
  service_name: string;
  price_min: number | null;
  price_max: number | null;
  price_fixed: number | null;
  currency: string;
  estimated_duration_minutes: number | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
