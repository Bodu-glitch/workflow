export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';

export const COLORS = {
  primary: '#FF6B2C',
  primaryLight: '#FF8F5C',
  primaryDark: '#E05520',
  secondary: '#1A1A2E',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  rating: '#F59E0B',
};

export const STATUS_LABELS: Record<string, string> = {
  // service_request statuses
  unavailable: 'Đang xem xét',
  available: 'Đang tìm kiếm',
  negotiating: 'Đang thương lượng',
  pending_assignment: 'Chờ nhân viên nhận',
  assigned: 'Nhân viên đang đến',
  in_progress: 'Đang xử lý',
  completed: 'Hoàn thành',
  completed_late: 'Hoàn thành (trễ)',
  cancelled: 'Đã hủy',
  // task statuses (after BO creates task from request)
  todo: 'Chờ nhân viên nhận',
  moving: '🚗 Nhân viên đang di chuyển',
  arrived: '📍 Nhân viên đã đến',
  done: '✅ Hoàn thành',
  rejected: 'Đã từ chối',
};

export const STATUS_COLORS: Record<string, string> = {
  unavailable: '#6B7280',
  available: '#3B82F6',
  negotiating: '#8B5CF6',
  pending_assignment: '#F59E0B',
  assigned: '#8B5CF6',
  in_progress: '#EF4444',
  completed: '#10B981',
  completed_late: '#F59E0B',
  cancelled: '#9CA3AF',
};

export const CATEGORY_ICONS: Record<string, string> = {
  'sua-laptop': '💻',
  'sua-xe-may': '🏍️',
  'sua-o-to': '🚗',
  'dien-dien-lanh': '❄️',
  'it-support': '🖥️',
  'khoa-cua': '🔑',
  'dien-dan-dung': '⚡',
};

export const CATEGORY_BG_COLORS: Record<string, string> = {
  'sua-laptop': '#EEF2FF',
  'sua-xe-may': '#FEF3C7',
  'sua-o-to': '#DCFCE7',
  'dien-dien-lanh': '#E0F2FE',
  'it-support': '#F3E8FF',
  'khoa-cua': '#FFE4E6',
  'dien-dan-dung': '#FEF9C3',
};

export const CATEGORY_PROBLEMS: Record<string, string[]> = {
  'sua-laptop': ['Không lên nguồn', 'Màn hình bị hỏng', 'Bàn phím không hoạt động', 'Pin chai/không sạc', 'Máy chạy chậm', 'Khác'],
  'sua-xe-may': ['Xe không nổ máy', 'Hỏng phanh', 'Thay lốp/vá xe', 'Xe bị ngã/hỏng', 'Đèn không sáng', 'Khác'],
  'sua-o-to': ['Xe không nổ máy', 'Hỏng lốp/thay lốp', 'Hết xăng', 'Điều hòa không mát', 'Hỏng phanh', 'Khác'],
  'dien-dien-lanh': ['Điều hòa không mát', 'Tủ lạnh không lạnh', 'Máy giặt hỏng', 'Quạt không chạy', 'Khác'],
  'it-support': ['Máy tính không kết nối mạng', 'Cài đặt phần mềm', 'Diệt virus', 'Sao lưu dữ liệu', 'Khác'],
  'khoa-cua': ['Quên chìa khóa', 'Khóa bị hỏng', 'Thay khóa mới', 'Két sắt bị khóa', 'Khác'],
  'dien-dan-dung': ['Đấu nối điện', 'Sửa ổ cắm/công tắc', 'Lắp đặt thiết bị điện', 'Cầu dao bị hỏng', 'Khác'],
};
