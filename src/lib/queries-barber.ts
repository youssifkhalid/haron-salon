import { supabase } from "@/integrations/supabase/client";

export type BarberFull = {
  id: string;
  user_id: string | null;
  name: string;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  cover_url: string | null;
  rating: number | null;
  is_active: boolean;
  sort_order: number;
  whatsapp: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  is_present_now: boolean;
  chair_number: number | null;
  working_hours: Record<string, string> | null;
};

export type PortfolioMedia = {
  id: string;
  item_id: string;
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url: string | null;
  sort_order: number;
  created_at: string;
};

export type PortfolioItem = {
  id: string;
  barber_id: string;
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  sort_order: number;
  is_pinned: boolean;
  created_at: string;
  media: PortfolioMedia[];
};

export const barberByUserQuery = (userId: string | undefined) => ({
  queryKey: ["barber", "by-user", userId],
  enabled: !!userId,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("user_id", userId!)
      .maybeSingle();
    if (error) throw error;
    return data as BarberFull | null;
  },
});

export const barberByIdQuery = (barberId: string) => ({
  queryKey: ["barber", barberId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("id", barberId)
      .maybeSingle();
    if (error) throw error;
    return data as BarberFull | null;
  },
});

export const barberPortfolioQuery = (barberId: string | undefined) => ({
  queryKey: ["barber-portfolio", barberId],
  enabled: !!barberId,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("barber_portfolio_items")
      .select("*, media:barber_portfolio_media(*)")
      .eq("barber_id", barberId!)
      .order("is_pinned", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    const items = (data ?? []) as any[];
    for (const it of items) {
      it.media = (it.media ?? []).slice().sort(
        (a: PortfolioMedia, b: PortfolioMedia) => a.sort_order - b.sort_order,
      );
      if (it.media.length === 0 && it.media_url) {
        it.media = [{
          id: it.id, item_id: it.id, media_type: it.media_type,
          media_url: it.media_url, thumbnail_url: it.thumbnail_url,
          sort_order: 0, created_at: it.created_at,
        }];
      }
    }
    return items as PortfolioItem[];
  },
});

export const barberBookingsQuery = (barberId: string | undefined) => ({
  queryKey: ["barber-bookings", barberId],
  enabled: !!barberId,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select("*, services(name, duration_minutes)")
      .eq("barber_id", barberId!)
      .order("booking_date", { ascending: false })
      .order("booking_time", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  },
});

/** Build a wa.me link from an Egyptian phone number or full international number. */
export function whatsappHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  // Assume Egypt (+20) if it starts with 0 and has 11 digits
  const intl = digits.startsWith("0") && digits.length === 11 ? "2" + digits : digits;
  return `https://wa.me/${intl}`;
}

export function socialHref(kind: "instagram" | "tiktok" | "facebook", raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  if (kind === "instagram") return `https://instagram.com/${handle}`;
  if (kind === "tiktok") return `https://tiktok.com/@${handle}`;
  if (kind === "facebook") return `https://facebook.com/${handle}`;
  return null;
}
