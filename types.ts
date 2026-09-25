export interface Salon {
  id: number;
  name: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  password?: string;
  owner_phone: string;
  country_id: number;
  city_id: number;
  area_id: number | null;
  address?: string;
  description?: string;
  portfolio_url?: string;
  cover_image?: string;
  cover_image_url?: string;
  logo?: string;
  logo_url?: string;
  established_year?: number;
  rating?: number;
  review_count?: number;
  latitude?: number;
  longitude?: number;
  status: 'active' | 'inactive' | 'pending';
  commission_rate?: number;
  commission_type?: 'percentage' | 'fixed';
}

export interface Country {
  id: number;
  name: string;
  code?: string;
  phone_code?: string;
  is_active: boolean;
}

export interface City {
  id: number;
  country_id: number;
  name: string;
  is_active: boolean;
}

export interface Area {
  id: number;
  city_id: number;
  name: string;
  is_active: boolean;
}

export interface SalonMedia {
  id: number;
  salon_id: number;
  media_url: string;
  media_type: 'image' | 'video';
  title?: string;
  description?: string;
  display_order: number;
  is_cover: boolean;
  created_at: string;
}

export interface SalonReview {
  id: number;
  salon_id: number;
  customer_phone: string;
  customer_name?: string;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface SalonPortfolio {
  id: number;
  salon_id: number;
  service_id?: number;
  title: string;
  description?: string;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
}

export interface Customer {
  phone: string;
  name?: string;
  global_points: number;
  loyalty_points: number;
  total_visits: number;
  referral_code?: string;
  status?: string;
  last_active?: string;
}

export interface Staff {
  id: number;
  salon_id: number;
  name: string;
  role: string;
  salary_type: 'fixed' | 'commission';
  base_salary: number;
  commission_rate: number;
  phone?: string;
}

export interface Service {
  id: number;
  salon_id: number;
  name: string;
  description?: string;
  price: number;
  duration: number;
  category?: string;
  is_active?: boolean;
}

export interface Booking {
  id: number;
  salon_id: number;
  customer_phone: string;
  customer_name?: string;
  service_id: number;
  barber_id?: number;
  staff_id?: number;
  booking_date: string;
  booking_time: string;
  end_time?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  token: string;
  notes?: string;
  created_at?: string;
}

export interface Barber {
  id: number;
  salon_id: number;
  name: string;
  phone?: string;
  email?: string;
  bio?: string;
  experience: number;
  specialization?: string;
  profile_image?: string;
  rating: number;
  review_count: number;
  status: 'active' | 'inactive';
  pin_code?: string;
}

export interface BarberPortfolio {
  id: number;
  barber_id: number;
  media_url: string;
  media_type: 'image' | 'video';
  title?: string;
}

export interface BarberSchedule {
  id: number;
  barber_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration: number;
  is_available: boolean;
  break_start?: string;
  break_end?: string;
}

export interface Appointment {
  id: number;
  salon_id: number;
  barber_id: number;
  customer_phone: string;
  customer_name?: string;
  service_id: number;
  appointment_date: string;
  appointment_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  token: string;
  notes?: string;
  salon_name?: string;
  barber_name?: string;
  service_name?: string;
}

export interface Offer {
  id: number;
  salon_id: number;
  title: string;
  description?: string;
  discount_percent?: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
}

export interface Product {
  id: number;
  salon_id: number;
  name: string;
  price: number;
  stock: number;
  min_stock: number;
  unit: string;
  is_active?: boolean;
}

export interface Review {
  id: number;
  salon_id: number;
  barber_id?: number;
  customer_phone: string;
  rating: number;
  comment?: string;
}

export interface Admin {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: 'super_admin' | 'admin' | 'support' | 'viewer';
  is_active: boolean;
  last_login?: string;
  created_at: string;
}
