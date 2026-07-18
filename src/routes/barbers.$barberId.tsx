import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Star, Calendar, X, Play, Armchair, Clock, Grid3x3, Film, Heart, MessageCircle, Share2, ChevronLeft, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { barberPortfolioQuery, type PortfolioItem, type BarberFull } from "@/lib/queries-barber";
import { SocialLinks } from "@/components/site/SocialIcons";

export const Route = createFileRoute("/barbers/$barberId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase.from("barbers").select("*").eq("id", params.barberId).eq("is_active", true).maybeSingle();
    if (error || !data) throw notFound();
    return { barber: data as unknown as BarberFull };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "الحلاق غير متاح" }, { name: "robots", content: "noindex" }] };
    const b = loaderData.barber;
    const title = `${b.name} — صالون هارون`;
    const desc = b.bio?.slice(0, 155) || `احجز مع ${b.name} في صالون هارون، وشاهد أعماله الأخيرة.`;
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

const DAY_ORDER = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
const DAY_LABEL: Record<string, string> = {
  sat: "السبت", sun: "الأحد", mon: "الاثنين", tue: "الثلاثاء",
  wed: "الأربعاء", thu: "الخميس", fri: "الجمعة",
};
const DAY_KEY_TODAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function BarberProfile() {
  const { barber } = Route.useLoaderData();
  const { data: portfolio = [] } = useQuery(barberPortfolioQuery(barber.id));
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);
  const [tab, setTab] = useState<"all" | "reels">("all");

  const filtered = useMemo(
    () => tab === "reels" ? portfolio.filter((p) => p.media_type === "video") : portfolio,
    [portfolio, tab]
  );
  const posts = portfolio.length;
  const reels = portfolio.filter((p) => p.media_type === "video").length;

  const today = DAY_KEY_TODAY[new Date().getDay()];
  const hoursList = DAY_ORDER.map((d) => ({
    key: d, label: DAY_LABEL[d],
    value: barber.working_hours?.[d]?.trim() || null,
    isToday: d === today,
  }));

  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {/* Cover */}
        <div className="relative overflow-hidden rounded-3xl border border-gold/15 bg-surface-elevated">
          <div
            className="h-40 sm:h-56 w-full bg-gold-gradient/40"
            style={barber.cover_url ? { backgroundImage: `url(${barber.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
        </div>

        <div className="-mt-16 px-2 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-full overflow-hidden border-4 border-background bg-gold-gradient grid place-items-center text-5xl font-black text-gold-foreground shadow-gold shrink-0">
              {barber.photo_url
                ? <img src={barber.photo_url} alt={barber.name} className="h-full w-full object-cover" />
                : barber.name.charAt(0)}
            </div>
            <div className="flex-1 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl sm:text-4xl font-black">{barber.name}</h1>
                {barber.is_present_now && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    متواجد الآن
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {barber.title && <span className="text-gold font-bold">{barber.title}</span>}
                <span className="inline-flex items-center gap-1 text-gold">
                  <Star className="h-3.5 w-3.5 fill-current" /> {Number(barber.rating ?? 5).toFixed(1)}
                </span>
                {barber.chair_number != null && (
                  <span className="inline-flex items-center gap-1">
                    <Armchair className="h-4 w-4 text-gold" /> كرسي {barber.chair_number}
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-6 text-sm">
                <div><b className="text-base font-black">{posts}</b> <span className="text-muted-foreground">منشور</span></div>
                <div><b className="text-base font-black">{reels}</b> <span className="text-muted-foreground">ريلز</span></div>
                <div className="inline-flex items-center gap-1"><b className="text-base font-black">{Number(barber.rating ?? 5).toFixed(1)}</b> <Star className="h-3.5 w-3.5 fill-gold text-gold" /></div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 w-full sm:w-auto">
              <Link
                to="/booking"
                search={{ barber: barber.id } as any}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-gold-gradient px-5 py-2.5 text-sm font-black text-gold-foreground shadow-gold hover:brightness-110"
              >
                <Calendar className="h-4 w-4" /> احجز موعد
              </Link>
              <ShareButton name={barber.name} />
            </div>
          </div>

          {barber.bio && (
            <p className="mt-5 text-sm leading-7 text-foreground/90 whitespace-pre-line max-w-2xl">
              {barber.bio}
            </p>
          )}

          <div className="mt-4">
            <SocialLinks whatsapp={barber.whatsapp} instagram={barber.instagram} tiktok={barber.tiktok} facebook={barber.facebook} size="md" />
          </div>

          <div className="mt-6 rounded-2xl border border-gold/15 bg-card p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-bold">
              <Clock className="h-4 w-4 text-gold" /> مواعيد العمل
            </div>
            <div className="flex overflow-x-auto gap-2 pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {hoursList.map((h) => (
                <div
                  key={h.key}
                  className={`shrink-0 min-w-[92px] rounded-xl border px-3 py-2 text-center transition ${
                    h.isToday ? "border-gold bg-gold/10" : "border-border bg-surface-elevated"
                  }`}
                >
                  <div className={`text-[11px] font-bold ${h.isToday ? "text-gold" : "text-muted-foreground"}`}>
                    {h.label}{h.isToday && " • اليوم"}
                  </div>
                  <div className="mt-0.5 text-xs font-black">
                    {h.value || <span className="text-muted-foreground/60">مغلق</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 border-t border-gold/15">
          <div className="flex justify-center gap-8">
            <TabBtn active={tab === "all"} onClick={() => setTab("all")} icon={<Grid3x3 className="h-4 w-4" />} label="المنشورات" />
            <TabBtn active={tab === "reels"} onClick={() => setTab("reels")} icon={<Film className="h-4 w-4" />} label="ريلزات" />
          </div>
        </div>

        {/* Grid feed */}
        {filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-14 text-center text-muted-foreground">
            {portfolio.length === 0 ? "لم يُضف أعمال بعد." : "لا يوجد ريلزات حتى الآن."}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-1 sm:gap-2">
            {filtered.map((it) => {
              const cover = it.media[0] ?? { media_type: it.media_type, media_url: it.media_url, thumbnail_url: it.thumbnail_url };
              const count = it.media.length || 1;
              return (
                <button
                  key={it.id}
                  onClick={() => setLightbox(it)}
                  className="group relative aspect-square overflow-hidden bg-black focus:outline-none focus:ring-2 focus:ring-gold/60"
                  aria-label={it.caption ?? "عرض"}
                >
                  {cover.media_type === "video" ? (
                    <>
                      {cover.thumbnail_url
                        ? <img src={cover.thumbnail_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                        : <video src={cover.media_url} className="h-full w-full object-cover" muted playsInline preload="metadata" />}
                      <div className="absolute top-1.5 left-1.5 rounded-full bg-black/60 p-1 text-white pointer-events-none">
                        <Play className="h-3 w-3 fill-white" />
                      </div>
                    </>
                  ) : (
                    <img src={cover.media_url} alt={it.caption ?? ""} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                  )}
                  {count > 1 && (
                    <div className="absolute top-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-white pointer-events-none">
                      1/{count}
                    </div>
                  )}
                  {it.is_pinned && (
                    <div className="absolute bottom-1.5 right-1.5 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-black text-gold-foreground pointer-events-none">
                      مثبّت
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition grid place-items-center opacity-0 group-hover:opacity-100 text-white text-xs font-bold">
                    <Heart className="h-6 w-6 fill-white" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Sticky mobile CTA */}
        <div className="fixed bottom-4 inset-x-4 z-30 sm:hidden">
          <Link
            to="/booking"
            search={{ barber: barber.id } as any}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gold-gradient px-5 py-3.5 text-sm font-black text-gold-foreground shadow-gold"
          >
            <Calendar className="h-4 w-4" /> احجز مع {barber.name}
          </Link>
        </div>
      </div>

      {lightbox && <Lightbox item={lightbox} barber={barber} onClose={() => setLightbox(null)} />}
    </SiteLayout>
  );
}

function Lightbox({ item, barber, onClose }: { item: PortfolioItem; barber: BarberFull; onClose: () => void }) {
  const media = item.media.length > 0 ? item.media : [{
    id: item.id, item_id: item.id, media_type: item.media_type,
    media_url: item.media_url, thumbnail_url: item.thumbnail_url, sort_order: 0, created_at: item.created_at,
  }];
  const [i, setI] = useState(0);
  const cur = media[i];
  const many = media.length > 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setI((v) => Math.min(media.length - 1, v + 1));
      if (e.key === "ArrowRight") setI((v) => Math.max(0, v - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/95 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <button className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 p-2 text-white" aria-label="إغلاق"><X className="h-6 w-6" /></button>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border p-3">
          <div className="h-9 w-9 rounded-full overflow-hidden bg-gold-gradient grid place-items-center text-sm font-black text-gold-foreground">
            {barber.photo_url ? <img src={barber.photo_url} className="h-full w-full object-cover" alt="" /> : barber.name.charAt(0)}
          </div>
          <div className="text-sm font-bold">{barber.name}</div>
          {many && <div className="mr-auto text-xs text-muted-foreground">{i + 1}/{media.length}</div>}
        </div>
        <div className="relative max-h-[70vh] bg-black grid place-items-center">
          {cur.media_type === "video"
            ? <video src={cur.media_url} controls autoPlay className="max-h-[70vh] w-auto" />
            : <img src={cur.media_url} alt={item.caption ?? ""} className="max-h-[70vh] w-auto object-contain" />}
          {many && i > 0 && (
            <button onClick={() => setI(i - 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/80 p-2 text-white" aria-label="السابق">
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          {many && i < media.length - 1 && (
            <button onClick={() => setI(i + 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/80 p-2 text-white" aria-label="التالي">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {many && (
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
              {media.map((_, idx) => (
                <span key={idx} className={`h-1.5 w-1.5 rounded-full ${idx === i ? "bg-white" : "bg-white/40"}`} />
              ))}
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4 text-foreground/80">
            <Heart className="h-6 w-6" />
            <MessageCircle className="h-6 w-6" />
            <Share2 className="h-6 w-6" />
          </div>
          {item.caption && <p className="mt-3 text-sm leading-6">{item.caption}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/booking"
              search={{ barber: barber.id } as any}
              className="inline-flex items-center gap-2 rounded-xl border border-gold/40 px-4 py-2 text-xs font-black text-gold hover:bg-gold/10"
            >
              <Calendar className="h-3.5 w-3.5" /> احجز مع {barber.name}
            </Link>
            <Link
              to="/booking"
              search={{ barber: barber.id, ref: item.id } as any}
              className="inline-flex items-center gap-2 rounded-xl bg-gold-gradient px-4 py-2 text-xs font-black text-gold-foreground shadow-gold"
            >
              <Calendar className="h-3.5 w-3.5" /> احجز مثل هذا
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 border-t-2 px-2 py-3 text-xs font-black tracking-widest transition ${
        active ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function ShareButton({ name }: { name: string }) {
  return (
    <button
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try { await navigator.share({ title: `${name} — صالون هارون`, url }); } catch {}
        } else {
          try { await navigator.clipboard.writeText(url); } catch {}
        }
      }}
      className="inline-flex items-center justify-center rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-foreground/80 hover:bg-accent/40"
      aria-label="مشاركة"
    >
      <Share2 className="h-4 w-4" />
    </button>
  );
}
