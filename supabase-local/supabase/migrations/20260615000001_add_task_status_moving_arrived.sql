ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'moving' AFTER 'todo';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'arrived' AFTER 'moving';
