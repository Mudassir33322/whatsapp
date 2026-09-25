export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'support' | 'viewer';
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface SalonSummary {
  id: number;
  name: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive' | 'pending';
  rating?: number;
  review_count?: number;
  city_name?: string;
  country_name?: string;
}

export interface AppointmentSummary {
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
  service_name?: string;
  barber_name?: string;
  salon_name?: string;
}

export interface DashboardStats {
  totalSalons: number;
  activeSalons: number;
  pendingSalons: number;
  totalAppointments: number;
  totalCustomers: number;
  totalRevenue: number;
}

export interface QueryResult {
  insertId?: number;
  affectedRows?: number;
}

export interface WorkingHourInput {
  day: number;
  start: string;
  end: string;
  isOpen: boolean;
}

export interface SeatInput {
  id?: number;
  salon_id: number;
  name: string;
  status?: string;
  assigned_staff_id?: number;
}

export interface SalaryInput {
  salon_id: number;
  staff_id: number;
  amount: number;
  type?: string;
  status?: string;
}

export interface ShopSettingsInput {
  salon_id: number;
  company_name: string;
  currency: string;
  language: string;
  address: string;
  map_url: string;
}
