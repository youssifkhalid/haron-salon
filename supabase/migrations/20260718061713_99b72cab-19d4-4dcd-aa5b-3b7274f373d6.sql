
-- 1) Extend barbers
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS tiktok text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS is_present_now boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS working_hours jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS barbers_user_id_key ON public.barbers(user_id) WHERE user_id IS NOT NULL;

-- 2) Barber self-update policy (limited to safe fields via trigger)
DROP POLICY IF EXISTS "Barbers can update own row" ON public.barbers;
CREATE POLICY "Barbers can update own row" ON public.barbers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Prevent barbers from changing sensitive fields
CREATE OR REPLACE FUNCTION public.barbers_guard_sensitive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- If the caller is the linked barber, block changes to sensitive columns
  IF OLD.user_id IS NOT NULL AND OLD.user_id = auth.uid() THEN
    NEW.is_active := OLD.is_active;
    NEW.rating := OLD.rating;
    NEW.sort_order := OLD.sort_order;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS barbers_guard_sensitive_trg ON public.barbers;
CREATE TRIGGER barbers_guard_sensitive_trg
  BEFORE UPDATE ON public.barbers
  FOR EACH ROW EXECUTE FUNCTION public.barbers_guard_sensitive();

-- 3) Portfolio items table
CREATE TABLE IF NOT EXISTS public.barber_portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  media_url text NOT NULL,
  thumbnail_url text,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.barber_portfolio_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_portfolio_items TO authenticated;
GRANT ALL ON public.barber_portfolio_items TO service_role;

ALTER TABLE public.barber_portfolio_items ENABLE ROW LEVEL SECURITY;

-- Public can read items for active barbers
CREATE POLICY "Public read portfolio of active barbers" ON public.barber_portfolio_items
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.is_active = true));

-- Owner (barber linked via user_id) can manage own items
CREATE POLICY "Barbers manage own portfolio" ON public.barber_portfolio_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.user_id = auth.uid()));

-- Admins full access
CREATE POLICY "Admins manage all portfolio" ON public.barber_portfolio_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER barber_portfolio_touch_updated BEFORE UPDATE ON public.barber_portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX IF NOT EXISTS barber_portfolio_barber_idx ON public.barber_portfolio_items(barber_id, sort_order);
