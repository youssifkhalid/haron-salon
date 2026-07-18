
-- booking_services: allow guest inserts (booking with user_id NULL and is_guest=true)
DROP POLICY IF EXISTS "bs insert own" ON public.booking_services;
CREATE POLICY "bs insert own" ON public.booking_services FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND (
        b.user_id = auth.uid()
        OR (b.user_id IS NULL AND b.is_guest = true)
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'staff')
      )
  )
);

DROP POLICY IF EXISTS "bs read own" ON public.booking_services;
CREATE POLICY "bs read own" ON public.booking_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND (
        b.user_id = auth.uid()
        OR (b.user_id IS NULL AND b.is_guest = true)
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'staff')
      )
  )
);

-- payment_proofs: allow guest insert when linked to a guest booking
ALTER TABLE public.payment_proofs ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "pp insert self" ON public.payment_proofs;
CREATE POLICY "pp insert self" ON public.payment_proofs FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR (
    user_id IS NULL
    AND booking_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = payment_proofs.booking_id
        AND b.user_id IS NULL
        AND b.is_guest = true
    )
  )
);

DROP POLICY IF EXISTS "pp self read" ON public.payment_proofs;
CREATE POLICY "pp self read" ON public.payment_proofs FOR SELECT
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Grants for anon (guests)
GRANT SELECT, INSERT ON public.bookings TO anon;
GRANT SELECT, INSERT ON public.booking_services TO anon;
GRANT SELECT, INSERT ON public.payment_proofs TO anon;
