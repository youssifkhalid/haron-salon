-- Fix guest booking permissions and receipt uploads

GRANT SELECT, INSERT ON public.bookings TO anon;
GRANT SELECT, INSERT ON public.booking_services TO anon;
GRANT SELECT, INSERT ON public.payment_proofs TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_proofs TO authenticated;

GRANT ALL ON public.bookings TO service_role;
GRANT ALL ON public.booking_services TO service_role;
GRANT ALL ON public.payment_proofs TO service_role;

DROP POLICY IF EXISTS "guests create bookings" ON public.bookings;
CREATE POLICY "guests create bookings"
ON public.bookings
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND is_guest = true
  AND length(trim(customer_name)) > 1
  AND length(trim(customer_phone)) >= 6
);

DROP POLICY IF EXISTS "bs insert own" ON public.booking_services;
CREATE POLICY "bs insert own"
ON public.booking_services
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND (
        b.user_id = auth.uid()
        OR (auth.uid() IS NULL AND b.user_id IS NULL AND b.is_guest = true)
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'staff')
      )
  )
);

DROP POLICY IF EXISTS "bs read own" ON public.booking_services;
CREATE POLICY "bs read own"
ON public.booking_services
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = booking_services.booking_id
      AND (
        b.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'staff')
      )
  )
);

DROP POLICY IF EXISTS "pp insert self" ON public.payment_proofs;
CREATE POLICY "pp insert self"
ON public.payment_proofs
FOR INSERT
TO public
WITH CHECK (
  (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  )
  OR (
    auth.uid() IS NULL
    AND user_id IS NULL
    AND booking_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = payment_proofs.booking_id
        AND b.user_id IS NULL
        AND b.is_guest = true
    )
  )
);

DROP POLICY IF EXISTS "pp self read" ON public.payment_proofs;
CREATE POLICY "pp self read"
ON public.payment_proofs
FOR SELECT
TO public
USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow anonymous guests to upload receipt screenshots only into payment-proofs folder.
GRANT SELECT, INSERT ON storage.objects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

DROP POLICY IF EXISTS "media guest payment proof insert" ON storage.objects;
CREATE POLICY "media guest payment proof insert"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'media'
  AND (name LIKE 'payment-proofs/%')
);

DROP POLICY IF EXISTS "media authenticated insert" ON storage.objects;
CREATE POLICY "media authenticated insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR name LIKE 'portfolio/%'
    OR name LIKE 'payment-proofs/%'
    OR name LIKE 'profiles/%'
  )
);