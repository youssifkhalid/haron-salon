
-- 1) Add 'pending_payment' to booking_status enum
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'pending_payment' BEFORE 'pending';

-- 2) Add sender_phone to payment_proofs (booking_id already exists)
ALTER TABLE public.payment_proofs ADD COLUMN IF NOT EXISTS sender_phone TEXT;

-- 3) Create booking_services table (multi-services per booking)
CREATE TABLE IF NOT EXISTS public.booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  price_egp NUMERIC(10,2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_services_booking_idx ON public.booking_services(booking_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_services TO authenticated;
GRANT ALL ON public.booking_services TO service_role;

ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bs read own" ON public.booking_services;
CREATE POLICY "bs read own" ON public.booking_services FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')))
  );

DROP POLICY IF EXISTS "bs insert own" ON public.booking_services;
CREATE POLICY "bs insert own" ON public.booking_services FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  );

DROP POLICY IF EXISTS "bs admin manage" ON public.booking_services;
CREATE POLICY "bs admin manage" ON public.booking_services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- 4) Seed deposit fields in booking_policy site_settings (merge)
INSERT INTO public.site_settings (key, value, description, is_public)
VALUES ('booking_policy', jsonb_build_object('deposit_required', false, 'deposit_amount_egp', 0), 'Booking rules', false)
ON CONFLICT (key) DO UPDATE SET value = public.site_settings.value
  || jsonb_build_object(
    'deposit_required', COALESCE(public.site_settings.value->'deposit_required', 'false'::jsonb),
    'deposit_amount_egp', COALESCE(public.site_settings.value->'deposit_amount_egp', '0'::jsonb)
  );
