CREATE TABLE IF NOT EXISTS public.task_service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  service_id UUID,
  label TEXT NOT NULL,
  unit_price NUMERIC(12,2) DEFAULT 0,
  is_custom BOOLEAN DEFAULT false,
  checked BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.task_service_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.task_service_items FOR ALL USING (true) WITH CHECK (true);
