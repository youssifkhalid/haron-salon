
-- Image columns
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb;

-- Guest bookings: relax user_id + add guest flag
ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

-- Allow anon insert for guest bookings (must supply customer_name+phone, no user_id, is_guest=true)
DROP POLICY IF EXISTS "guests create bookings" ON public.bookings;
CREATE POLICY "guests create bookings" ON public.bookings
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND is_guest = true AND length(customer_name) > 1 AND length(customer_phone) >= 6);

-- Also allow authenticated users to create guest-style bookings (skip login flow)
DROP POLICY IF EXISTS "users create own bookings" ON public.bookings;
CREATE POLICY "users create own bookings" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) OR (user_id IS NULL AND is_guest = true));

GRANT INSERT ON public.bookings TO anon;

-- Subscription requests table (manual payment approval for plans)
CREATE TABLE IF NOT EXISTS public.subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  receipt_url text NOT NULL,
  sender_phone text,
  amount_egp numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.subscription_requests TO authenticated;
GRANT ALL ON public.subscription_requests TO service_role;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr admin all" ON public.subscription_requests;
CREATE POLICY "sr admin all" ON public.subscription_requests FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "sr self read" ON public.subscription_requests;
CREATE POLICY "sr self read" ON public.subscription_requests FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "sr self insert" ON public.subscription_requests;
CREATE POLICY "sr self insert" ON public.subscription_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_sr_touch ON public.subscription_requests;
CREATE TRIGGER trg_sr_touch BEFORE UPDATE ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Allow media bucket read for anon (already public-ish through signed URLs, but ensure select on objects)
