-- Allow RLS policies to validate guest parent bookings without exposing guest bookings publicly

CREATE OR REPLACE FUNCTION public.is_guest_booking(_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = _booking_id
      AND b.user_id IS NULL
      AND b.is_guest = true
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_guest_booking(uuid) TO anon, authenticated, service_role;

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
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'staff')
      )
  )
  OR (auth.uid() IS NULL AND public.is_guest_booking(booking_services.booking_id))
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
    AND public.is_guest_booking(booking_id)
  )
);