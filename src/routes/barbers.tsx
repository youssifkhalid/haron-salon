import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Star, ArrowLeft } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { barbersQuery } from "@/lib/queries";
import type { BarberFull } from "@/lib/queries-barber";
import { SocialLinks } from "@/components/site/SocialIcons";

export const Route = createFileRoute("/barbers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(barbersQuery()),
  head: () => ({
    meta: [
      { title: "طاقم الحلاقين — صالون هارون" },
      { name: "description", content: "تعرّف على فريق حلاقي صالون هارون — خبرات وفنون في خدمتك." },
    ],
  }),
  component: BarbersPage,
});

function BarbersPage() {
  const { data: barbers } = useSuspenseQuery(barbersQuery());
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <header className="max-w-2xl">
          <div className="text-xs font-black tracking-[0.35em] text-gold">الطاقم</div>
          <h1 className="mt-3 font-display text-4xl font-black sm:text-5xl">فريقنا المحترف</h1>
          <p className="mt-4 text-muted-foreground">حلاقون بخبرات تمتد لعقود، شغفهم إتقان التفاصيل.</p>
        </header>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((b, i) => {
            const barber = b as unknown as BarberFull;
            return (
              <Link
                key={barber.id}
                to="/barbers/$barberId"
                params={{ barberId: barber.id }}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-gold/10 bg-surface animate-fade-up hover:border-gold/40 transition"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-gold-gradient">
                  {barber.cover_url && (
                    <img src={barber.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" loading="lazy" />
                  )}
                  {barber.photo_url ? (
                    <img
                      src={barber.photo_url}
                      alt={barber.name}
                      className="relative h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="relative grid h-full w-full place-items-center text-7xl font-black text-gold-foreground">
                      {barber.name.charAt(0)}
                    </div>
                  )}
                  {barber.is_present_now && (
                    <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-white">
                      <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span>
                      متواجد الآن
                    </div>
                  )}
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-6">
                  <div className="text-xs font-bold tracking-widest text-gold">{barber.title}</div>
                  <div className="flex items-center justify-between">
                    <h3 className="mt-0.5 text-2xl font-black">{barber.name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold">
                      <Star className="h-3.5 w-3.5 fill-gold" /> {Number(barber.rating ?? 5).toFixed(1)}
                    </span>
                  </div>
                  {barber.bio && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{barber.bio}</p>}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div onClick={(e) => e.preventDefault()}>
                      <SocialLinks whatsapp={barber.whatsapp} instagram={barber.instagram} tiktok={barber.tiktok} facebook={barber.facebook} size="sm" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-gold group-hover:gap-2 transition-all">
                      الملف <ArrowLeft className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </SiteLayout>
  );
}
