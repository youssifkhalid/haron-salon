-- Re-assert API grants for guest booking flow explicitly

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.bookings TO anon;
GRANT SELECT, INSERT ON TABLE public.booking_services TO anon;
GRANT SELECT, INSERT ON TABLE public.payment_proofs TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_proofs TO authenticated;

GRANT ALL PRIVILEGES ON TABLE public.bookings TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.booking_services TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.payment_proofs TO service_role;

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE storage.objects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO authenticated;
GRANT ALL PRIVILEGES ON TABLE storage.objects TO service_role;