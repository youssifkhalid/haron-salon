
-- 1) is_pinned on portfolio items
ALTER TABLE public.barber_portfolio_items
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS barber_portfolio_pin_idx
  ON public.barber_portfolio_items (barber_id, is_pinned DESC, sort_order);

-- 2) new media table
CREATE TABLE IF NOT EXISTS public.barber_portfolio_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.barber_portfolio_items(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  media_url text NOT NULL,
  thumbnail_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS barber_portfolio_media_item_idx
  ON public.barber_portfolio_media (item_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_portfolio_media TO authenticated;
GRANT SELECT ON public.barber_portfolio_media TO anon;
GRANT ALL ON public.barber_portfolio_media TO service_role;

ALTER TABLE public.barber_portfolio_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read media of active barbers"
  ON public.barber_portfolio_media FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barber_portfolio_items i
    JOIN public.barbers b ON b.id = i.barber_id
    WHERE i.id = barber_portfolio_media.item_id AND b.is_active = true
  ));

CREATE POLICY "Barbers manage own media"
  ON public.barber_portfolio_media FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.barber_portfolio_items i
    JOIN public.barbers b ON b.id = i.barber_id
    WHERE i.id = barber_portfolio_media.item_id AND b.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.barber_portfolio_items i
    JOIN public.barbers b ON b.id = i.barber_id
    WHERE i.id = barber_portfolio_media.item_id AND b.user_id = auth.uid()
  ));

CREATE POLICY "Admins manage all media"
  ON public.barber_portfolio_media FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) backfill: one media row per existing portfolio item, only if none exists yet
INSERT INTO public.barber_portfolio_media (item_id, media_type, media_url, thumbnail_url, sort_order)
SELECT i.id, i.media_type, i.media_url, i.thumbnail_url, 0
FROM public.barber_portfolio_items i
WHERE NOT EXISTS (
  SELECT 1 FROM public.barber_portfolio_media m WHERE m.item_id = i.id
);

-- 4) reference_portfolio_item_id on bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reference_portfolio_item_id uuid
  REFERENCES public.barber_portfolio_items(id) ON DELETE SET NULL;
