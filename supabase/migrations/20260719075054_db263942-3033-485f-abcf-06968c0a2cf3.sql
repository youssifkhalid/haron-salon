
-- 1) Branches table
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  working_hours TEXT,
  telegram_chat_id TEXT,
  whatsapp_number TEXT,
  notification_prefs JSONB NOT NULL DEFAULT '{"telegram": true, "whatsapp": false}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.branches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_public_read_active" ON public.branches
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "branches_admin_all" ON public.branches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_branches_updated_at ON public.branches;
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 2) Seed 2 default branches
INSERT INTO public.branches (name, sort_order, notification_prefs)
VALUES
  ('الفرع الأول', 1, '{"telegram": true, "whatsapp": false}'::jsonb),
  ('الفرع الثاني', 2, '{"telegram": true, "whatsapp": false}'::jsonb)
ON CONFLICT DO NOTHING;

-- 3) Add branch_id to barbers + bookings
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Backfill: assign existing barbers/bookings to first branch
UPDATE public.barbers SET branch_id = (SELECT id FROM public.branches ORDER BY sort_order LIMIT 1)
  WHERE branch_id IS NULL;
UPDATE public.bookings SET branch_id = (SELECT id FROM public.branches ORDER BY sort_order LIMIT 1)
  WHERE branch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_barbers_branch ON public.barbers(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_branch ON public.bookings(branch_id);

-- 4) Extend notifications_log
ALTER TABLE public.notifications_log ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.notifications_log ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.notifications_log ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE public.notifications_log ADD COLUMN IF NOT EXISTS payload JSONB;

-- 5) Global notification settings
INSERT INTO public.site_settings (key, value)
VALUES ('notification_channels', '{"telegram_enabled": true, "whatsapp_enabled": false, "events": {"new_booking": true, "new_order": true, "low_stock": true, "barber_absent": true}}'::jsonb)
ON CONFLICT (key) DO NOTHING;
