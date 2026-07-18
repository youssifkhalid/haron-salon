import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Star, Calendar, ArrowRight, X, Play } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { barberByIdQuery, barberPortfolioQuery, type PortfolioItem } from "@/lib/queries-barber";
import { SocialLinks } from "@/components/site/SocialIcons";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/barbers/$barberId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase.from("barbers").select("*").eq("id", params.barberId).eq("is_active", true).maybeSingle();
    if (error || !data) throw notFound();
    return { barber: data };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "الحلاق غير متاح" }, { name: "robots", content: "noindex" }] };
    const b = loaderData.barber;
    const title = `${b.name} — صالون هارون`;
    const desc = b.bio?.slice(0, 155) || `احجز مع ${b.name} في صالون هارون`;
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      ...(b.photo_url ? [{ property: "og:image", content: b.photo_url } as any] : []),
    ]};
  },
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-black">الحلاق غير موجود</h1>
        <Link to="/barbers" className="mt-6 inline-block text-sm text-gold hover:underline">← عودة لطاقم الحلاقين</Link>
      </div>
    </SiteLayout>
  ),
  errorComponent: () => (<SiteLayout><div className="mx-auto max-w-lg px-4 py-24 text-center"><h1 className="font-display text-2xl">حدث خطأ</h1></div></SiteLayout>),
  component: BarberProfile,
});

function BarberProfile() {
  const { barber } = Route.useLoaderData();
  const { data: portfolio = [] } = useQuery(barberPortfolioQuery(barber.id));
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-gold/15 bg-surface-elevated">
          <div className="h-48 sm:h-64 w-full bg-gold-gradient/40"
            style={barber.cover_url ? { backgroundImage: `url(${barber.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
          <div className="relative -mt-24 sm:-mt-28 px-6 pb-8 flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-3xl overflow-hidden border-4 border-surface-elevated bg-gold-gradient grid place-items-center text-5xl font-black text-gold-foreground shadow-gold shrink-0">
              {barber.photo_url ? <img src={barber.photo_url} alt={barber.name} className="h-full w-full object-cover" /> : barber.name.charAt(0)}
            </div>
            <div className="flex-1 pt-4">
              {barber.is_present_now && (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 mb-2 text-xs font-bold text-emerald-400">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
                  متواجد الآن في الصالون
                </div>
              )}
              <div className="text-xs font-bold text-gold tracking-widest">{barber.title ?? "حلاق"}</div>
              <h1 className="mt-1 font-display text-4xl sm:text-5xl font-black">{barber.name}</h1>
              <div className="mt-2 inline-flex items-center gap-1.5 text-gold">
                <Star className="h-4 w-4 fill-current" /> <span className="font-bold">{Number(barber.rating ?? 5).toFixed(1)}</span>
              </div>
            </div>
            <Link to="/booking" search={{ barber: barber.id } as any}
              className="rounded-xl bg-gold-gradient px-5 py-3 text-sm font-black text-gold-foreground shadow-gold hover:brightness-110 inline-flex items-center gap-2">
              احجز مع {barber.name} <ArrowRight className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        </div>

        {/* Bio + Socials */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-gold/10 bg-card p-6">
            <h2 className="font-display text-xl font-black mb-2">نبذة</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {barber.bio || "حلاق محترف في صالون هارون، شغف بالتفاصيل وخدمة على أعلى مستوى."}
            </p>
          </div>
          <div className="rounded-2xl border border-gold/10 bg-card p-6">
            <h2 className="font-display text-lg font-black mb-3">تواصل معي</h2>
            <SocialLinks whatsapp={barber.whatsapp} instagram={barber.instagram} tiktok={barber.tiktok} facebook={barber.facebook} size="lg" />
            {![barber.whatsapp, barber.instagram, barber.tiktok, barber.facebook].some(Boolean) && (
              <div className="text-xs text-muted-foreground">لا توجد وسائل تواصل مضافة بعد.</div>
            )}
            <Link to="/booking" search={{ barber: barber.id } as any}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gold/40 py-2.5 text-sm font-bold text-gold hover:bg-gold/10">
              <Calendar className="h-4 w-4" /> حجز موعد
            </Link>
          </div>
        </div>

        {/* Portfolio */}
        <div className="mt-8">
          <h2 className="font-display text-2xl font-black">معرض الأعمال</h2>
          {portfolio.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">لم يُضف أعمال بعد.</div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {portfolio.map((it) => (
                <button key={it.id} onClick={() => setLightbox(it)}
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-gold/10 bg-black">
                  {it.media_type === "video" ? (
                    <>
                      <video src={it.media_url} className="h-full w-full object-cover transition group-hover:scale-105" muted playsInline preload="metadata" />
                      <div className="absolute inset-0 grid place-items-center bg-black/30 pointer-events-none">
                        <Play className="h-10 w-10 text-white fill-white/80" />
                      </div>
                    </>
                  ) : (
                    <img src={it.media_url} alt={it.caption ?? ""} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                  )}
                  {it.caption && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-xs text-white text-right opacity-0 group-hover:opacity-100 transition">{it.caption}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 p-2 text-white" aria-label="إغلاق"><X className="h-6 w-6" /></button>
          <div className="max-h-[90vh] max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            {lightbox.media_type === "video"
              ? <video src={lightbox.media_url} controls autoPlay className="max-h-[80vh] mx-auto rounded-2xl" />
              : <img src={lightbox.media_url} alt={lightbox.caption ?? ""} className="max-h-[80vh] mx-auto rounded-2xl object-contain" />}
            {lightbox.caption && <div className="mt-3 text-center text-white text-sm">{lightbox.caption}</div>}
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
