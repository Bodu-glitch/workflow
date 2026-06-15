import { View, Text } from '@/tw';
import type { TaskStatus, TaskPriority } from '@/types/api';

// Uses Executive Kinetic design tokens — container colors for tonal harmony
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending_assignment: { bg: 'bg-warning-container',         text: 'text-on-warning-container' },
  assigned:    { bg: 'bg-primary-container',         text: 'text-on-primary-container' },
  todo:        { bg: 'bg-warning-container',         text: 'text-on-warning-container' },
  moving:      { bg: 'bg-secondary-container',       text: 'text-on-secondary-container' },
  arrived:     { bg: 'bg-tertiary-container',        text: 'text-on-tertiary-container' },
  in_progress: { bg: 'bg-secondary-container',       text: 'text-on-secondary-container' },
  done:        { bg: 'bg-success-container',          text: 'text-on-success-container' },
  completed:   { bg: 'bg-success-container',          text: 'text-on-success-container' },
  completed_late: { bg: 'bg-warning-container',      text: 'text-on-warning-container' },
  cancelled:   { bg: 'bg-surface-container-highest', text: 'text-on-surface-variant' },
  rejected:    { bg: 'bg-error-container',            text: 'text-on-error-container' },
};

const STATUS_LABEL: Record<string, string> = {
  pending_assignment: 'CHỜ GIAO',
  assigned:    'MỚI',
  todo:        'PENDING',
  moving:      'DI CHUYỂN',
  arrived:     'ĐÃ ĐẾN',
  in_progress: 'ĐANG LÀM',
  done:        'COMPLETED',
  completed:   'HOÀN THÀNH',
  completed_late: 'HOÀN THÀNH (TRỄ)',
  cancelled:   'ĐÃ HỦY',
  rejected:    'TỪ CHỐI',
};

// Priority: left-edge pill color (4px wide) per design system
export const PRIORITY_PILL_COLOR: Record<string, string> = {
  low:    'bg-success',
  normal: 'bg-secondary',
  medium: 'bg-secondary',
  high:   'bg-tertiary',
  urgent: 'bg-error',
};

const PRIORITY_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  low:    { bg: 'bg-success-container',          text: 'text-on-success-container' },
  normal: { bg: 'bg-secondary-container',        text: 'text-on-secondary-container' },
  medium: { bg: 'bg-secondary-container',        text: 'text-on-secondary-container' },
  high:   { bg: 'bg-on-tertiary-container',      text: 'text-tertiary' },
  urgent: { bg: 'bg-error-container',            text: 'text-on-error-container' },
};

export function StatusBadge({ status }: { status: string }) {
  const { bg, text } = STATUS_STYLES[status] ?? STATUS_STYLES['cancelled'];
  return (
    <View className={`self-start px-2.5 py-1 rounded-full ${bg}`}>
      <Text className={`text-[10px] font-bold tracking-wider ${text}`}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority | string }) {
  const { bg, text } = PRIORITY_BADGE_STYLES[priority] ?? PRIORITY_BADGE_STYLES['normal'];
  return (
    <View className={`self-start px-2.5 py-1 rounded-full ${bg}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${text}`}>
        {priority}
      </Text>
    </View>
  );
}
