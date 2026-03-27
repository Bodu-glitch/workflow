import { View, Text } from '@/tw';
import type { TaskStatus, TaskPriority } from '@/types/api';

// Uses Executive Kinetic design tokens — container colors for tonal harmony
const STATUS_STYLES: Record<TaskStatus, { bg: string; text: string }> = {
  todo:        { bg: 'bg-warning-container',         text: 'text-on-warning-container' },
  in_progress: { bg: 'bg-secondary-container',       text: 'text-on-secondary-container' },
  done:        { bg: 'bg-success-container',          text: 'text-on-success-container' },
  cancelled:   { bg: 'bg-surface-container-highest', text: 'text-on-surface-variant' },
  rejected:    { bg: 'bg-error-container',            text: 'text-on-error-container' },
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'PENDING',
  in_progress: 'IN PROGRESS',
  done:        'COMPLETED',
  cancelled:   'CANCELLED',
  rejected:    'REJECTED',
};

// Priority: left-edge pill color (4px wide) per design system
export const PRIORITY_PILL_COLOR: Record<TaskPriority, string> = {
  low:    'bg-success',
  medium: 'bg-secondary',
  high:   'bg-tertiary',
  urgent: 'bg-error',
};

const PRIORITY_BADGE_STYLES: Record<TaskPriority, { bg: string; text: string }> = {
  low:    { bg: 'bg-success-container',          text: 'text-on-success-container' },
  medium: { bg: 'bg-secondary-container',        text: 'text-on-secondary-container' },
  high:   { bg: 'bg-on-tertiary-container',      text: 'text-tertiary' },
  urgent: { bg: 'bg-error-container',            text: 'text-on-error-container' },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { bg, text } = STATUS_STYLES[status];
  return (
    <View className={`self-start px-2.5 py-1 rounded-full ${bg}`}>
      <Text className={`text-[10px] font-bold tracking-wider ${text}`}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { bg, text } = PRIORITY_BADGE_STYLES[priority];
  return (
    <View className={`self-start px-2.5 py-1 rounded-full ${bg}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${text}`}>
        {priority}
      </Text>
    </View>
  );
}
