import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { z } from "zod";
import {
  CalendarDays, Clock, ChevronLeft, User, Phone, Check, Scissors, Star,
  Copy, Wallet, ExternalLink, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import {
  servicesQuery, barbersQuery, activePaymentMethodsQuery, bookingPolicyQuery,
  type Service, type Barber,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { MediaUploadField } from "@/components/site/MediaUploadField";
import { useServerFn } from "@tanstack/react-start";
import { notifyBookingCreated } from "@/lib/notifications.functions";

const searchSchema = z.object({
  service: z.string().optional(),
  barber: z.string().optional(),
  ref: z.string().optional(),
  guest: z.union([z.literal("1"), z.literal("true"), z.boolean()]).optional(),
});


export const Route = createFileRoute("/booking")({
  validateSearch: searchSchema,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(servicesQuery()),
      context.queryClient.ensureQueryData(barbersQuery()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "احجز موعدك — صالون هارون" },
      { name: "description", content: "احجز موعدك في صالون هارون خلال ثوانٍ. اختر خدمة أو أكثر والحلاق والوقت المناسب." },
    ],
  }),
  component: BookingPage,
});

const TIMES = [
  "10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00",
];

function BookingPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: services } = useSuspenseQuery(servicesQuery());
  const { data: barbers } = useSuspenseQuery(barbersQuery());
  const { data: policy = {} } = useQuery(bookingPolicyQuery());
  const { data: methods = [] } = useQuery(activePaymentMethodsQuery());

  const depositRequired = !!policy.deposit_required;
  const depositAmount = Number(policy.deposit_amount_egp || 0);
  const depositActive = depositRequired && depositAmount > 0;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [step, setStep] = useState(1);
  const [serviceIds, setServiceIds] = useState<string[]>(search.service ? [search.service] : []);
  const [barberId, setBarberId] = useState<string>(search.barber ?? "");
  const [date, setDate] = useState<string>(todayStr);
  const [time, setTime] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [takenTimes, setTakenTimes] = useState<string[]>([]);

  // Deposit step state
  const [methodId, setMethodId] = useState<string>("");
  const [senderPhone, setSenderPhone] = useState("");
  const [proofUrl, setProofUrl] = useState<string>("");

  // Reference portfolio item (from "احجز مثل هذا")
  const { data: referenceItem } = useQuery({
    queryKey: ["ref-portfolio-item", search.ref],
    enabled: !!search.ref,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barber_portfolio_items")
        .select("id, caption, media_url, thumbnail_url, media_type, media:barber_portfolio_media(media_url, thumbnail_url, media_type, sort_order)")
        .eq("id", search.ref!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const selectedServices = useMemo(
    () => services.filter((s: Service) => serviceIds.includes(s.id)),
    [serviceIds, services],
  );
  const totalPrice = selectedServices.reduce((a, s) => a + Number(s.price_egp), 0);
  const totalDuration = selectedServices.reduce((a, s) => a + Number(s.duration_minutes), 0);

  const dayOptions = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(today.getDate() + i);
      return { value: d.toISOString().slice(0, 10), day: d.toLocaleDateString("ar-EG", { weekday: "short" }), num: d.getDate(), month: d.toLocaleDateString("ar-EG", { month: "short" }) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    (async () => {
      let q = supabase.from("bookings").select("booking_time, barber_id").eq("booking_date", date).neq("status", "cancelled");
      if (barberId) q = q.eq("barber_id", barberId);
      const { data } = await q;
      if (!alive) return;
      setTakenTimes((data ?? []).map((r: any) => (r.booking_time as string).slice(0, 5)));
    })();
    return () => { alive = false; };
  }, [date, barberId]);

  // Working-hours filter: only when a specific barber is picked.
  const selectedBarberFull = barbers.find((b: Barber) => b.id === barberId) as any;
  const dayKeyOfDate = useMemo(() => {
    if (!date) return null;
    const d = new Date(date + "T00:00:00");
    return ["sun","mon","tue","wed","thu","fri","sat"][d.getDay()];
  }, [date]);
  const barberDayRange = useMemo(() => {
    if (!barberId || !selectedBarberFull?.working_hours || !dayKeyOfDate) return null;
    const raw = (selectedBarberFull.working_hours as Record<string, string>)[dayKeyOfDate];
    if (!raw) return null;
    const m = raw.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    const startMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const endMin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
    return { startMin, endMin };
  }, [barberId, selectedBarberFull, dayKeyOfDate]);
  const barberIsOffToday = !!(barberId && selectedBarberFull?.working_hours && dayKeyOfDate && !(selectedBarberFull.working_hours as Record<string, string>)[dayKeyOfDate]?.trim());
  const availableTimes = useMemo(() => {
    if (!barberId || !barberDayRange) return TIMES;
    const dur = Math.max(1, totalDuration || 30);
    return TIMES.filter((t) => {
      const [hh, mm] = t.split(":").map((x) => parseInt(x, 10));
      const mins = hh * 60 + mm;
      return mins >= barberDayRange.startMin && (mins + dur) <= barberDayRange.endMin;
    });
  }, [barberId, barberDayRange, totalDuration]);

  const dayLabelAr: Record<string, string> = { sat:"السبت", sun:"الأحد", mon:"الاثنين", tue:"الثلاثاء", wed:"الأربعاء", thu:"الخميس", fri:"الجمعة" };


  const steps = depositActive
    ? ["الخدمة", "الحلاق", "الموعد", "بياناتك", "الدفع"]
    : ["الخدمة", "الحلاق", "الموعد", "بياناتك"];
  const lastStep = steps.length;

  function toggleService(id: string) {
    setServiceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function copyText(t: string) {
    navigator.clipboard.writeText(t).then(() => toast.success("تم النسخ"));
  }

  async function createBooking(status: "pending" | "pending_payment") {
    const isGuest = !user;
    if (!user && !isGuest) {
      toast.error("سجّل دخولك أولاً");
      navigate({ to: "/auth", search: { redirect: "/booking" } });
      return null;
    }
    if (selectedServices.length === 0 || !date || !time || !name.trim() || !phone.trim()) {
      toast.error("رجاءً أكمل كل الحقول"); return null;
    }
    const primary = selectedServices[0];
    const bookingId = crypto.randomUUID();
    const { error } = await supabase.from("bookings").insert({
      id: bookingId,
      user_id: user?.id ?? null,
      is_guest: isGuest,
      service_id: primary.id,
      barber_id: barberId || null,
      booking_date: date,
      booking_time: time,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      notes: notes.trim() || null,
      price_egp: totalPrice,
      status,
      reference_portfolio_item_id: search.ref || null,
    });
    if (error) { toast.error("تعذّر إنشاء الحجز: " + error.message); return null; }

    // Insert booking_services snapshot rows
    const rows = selectedServices.map((s) => ({
      booking_id: bookingId, service_id: s.id,
      price_egp: s.price_egp, duration_minutes: s.duration_minutes,
    }));
    const { error: bsErr } = await supabase.from("booking_services").insert(rows);
    if (bsErr) console.warn("booking_services insert warning:", bsErr.message);
    return bookingId;
  }


  async function submitWithoutDeposit() {
    setSubmitting(true);
    const id = await createBooking("pending");
    setSubmitting(false);
    if (!id) return;
    toast.success("تم حجز موعدك! سنتواصل معك للتأكيد.");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    navigate({ to: user ? "/account" : "/" });
  }


  async function submitWithDeposit() {
    const isGuest = !user;
    if (!user && !isGuest) { toast.error("سجّل دخولك أولاً"); return; }
    if (!methodId) { toast.error("اختر وسيلة دفع"); return; }
    if (!senderPhone.trim()) { toast.error("أدخل رقم الهاتف الذي حوّلت منه"); return; }
    if (!proofUrl) { toast.error("ارفع صورة إثبات التحويل"); return; }
    setSubmitting(true);
    const bookingId = await createBooking("pending_payment");
    if (!bookingId) { setSubmitting(false); return; }
    const { error } = await supabase.from("payment_proofs").insert({
      user_id: user?.id ?? null,
      booking_id: bookingId,
      method_id: methodId,
      amount_egp: depositAmount,
      sender_phone: senderPhone.trim(),
      image_url: proofUrl,
      status: "pending",
    });
    setSubmitting(false);
    if (error) { toast.error("تعذّر إرسال إثبات الدفع: " + error.message); return; }
    toast.success("تم إرسال طلبك! ستتم مراجعة الدفع وتأكيد حجزك قريبًا.");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    navigate({ to: user ? "/account" : "/" });
  }


  const selectedBarber = barbers.find((b: Barber) => b.id === barberId);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 pb-32">
        <header className="mb-8 text-center">
          <div className="text-xs font-black tracking-[0.35em] text-gold">الحجز</div>
          <h1 className="mt-3 font-display text-3xl font-black sm:text-4xl">احجز موعدك في دقيقة</h1>
        </header>

        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-2 flex-wrap">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`grid h-9 w-9 place-items-center rounded-full text-xs font-black transition ${step > i + 1 ? "bg-gold-gradient text-gold-foreground" : step === i + 1 ? "bg-gold-gradient text-gold-foreground shadow-gold" : "bg-surface-elevated text-muted-foreground"}`}>
                {step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`hidden sm:block text-xs font-bold ${step >= i + 1 ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              {i < steps.length - 1 && <div className={`mx-1 h-px w-6 sm:w-10 ${step > i + 1 ? "bg-gold" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-gold/10 bg-card p-5 sm:p-8 shadow-elegant">
          {step === 1 && (
            <div className="animate-fade-up">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">اختر الخدمات</h2>
                <span className="text-xs text-muted-foreground">يمكنك اختيار أكثر من خدمة</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((s: Service) => {
                  const active = serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleService(s.id)}
                      className={`relative text-right rounded-2xl border p-4 transition ${active ? "border-gold bg-gold/10 shadow-gold" : "border-border hover:border-gold/40"}`}
                    >
                      <div className={`absolute top-3 left-3 grid h-6 w-6 place-items-center rounded-md border-2 transition ${active ? "border-gold bg-gold-gradient" : "border-border"}`}>
                        {active && <Check className="h-4 w-4 text-gold-foreground" />}
                      </div>
                      <div className="flex items-start justify-between gap-3 pl-8">
                        <div className="min-w-0">
                          <div className="font-bold">{s.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="font-black text-gold-gradient">{s.price_egp} ج.م</div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{s.duration_minutes} د</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-up">
              <h2 className="mb-4 text-lg font-bold">اختر الحلاق (اختياري)</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setBarberId("")}
                  className={`text-right rounded-2xl border p-4 transition ${!barberId ? "border-gold bg-gold/10 shadow-gold" : "border-border hover:border-gold/40"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-gold/10 text-gold">
                      <Scissors className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-bold">أي حلاق متاح</div>
                      <div className="text-xs text-muted-foreground">سنختار لك أفضل حلاق متاح</div>
                    </div>
                  </div>
                </button>
                {barbers.map((b: Barber) => {
                  const active = barberId === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setBarberId(b.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setBarberId(b.id)}
                      className={`cursor-pointer text-right rounded-2xl border p-4 transition ${active ? "border-gold bg-gold/10 shadow-gold" : "border-border hover:border-gold/40"}`}
                    >
                      <div className="flex items-start gap-3">
                        {b.photo_url ? (
                          <img src={b.photo_url} alt={b.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-gold/30" />
                        ) : (
                          <div className="grid h-14 w-14 place-items-center rounded-full bg-gold-gradient text-lg font-black text-gold-foreground">
                            {b.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-bold">{b.name}</div>
                            {b.is_present_now && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> متواجد الآن
                              </span>
                            )}
                          </div>
                          {b.title && <div className="text-xs font-bold text-gold">{b.title}</div>}
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {b.rating != null && (
                              <span className="inline-flex items-center gap-0.5">
                                <Star className="h-3 w-3 fill-gold text-gold" /> {Number(b.rating).toFixed(1)}
                              </span>
                            )}
                          </div>
                          {b.bio && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{b.bio}</div>}
                          <a
                            href={`/barbers/${b.id}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-gold/40 px-2.5 py-1 text-[11px] font-bold text-gold hover:bg-gold/10"
                          >
                            <ExternalLink className="h-3 w-3" /> عرض الملف الشخصي
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-up">
              <h2 className="mb-4 text-lg font-bold inline-flex items-center gap-2"><CalendarDays className="h-5 w-5 text-gold" /> اختر التاريخ</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dayOptions.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => { setDate(d.value); setTime(""); }}
                    className={`shrink-0 rounded-2xl border px-4 py-3 text-center transition min-w-[80px] ${date === d.value ? "border-gold bg-gold/10 shadow-gold" : "border-border hover:border-gold/40"}`}
                  >
                    <div className="text-[11px] text-muted-foreground">{d.day}</div>
                    <div className="text-xl font-black">{d.num}</div>
                    <div className="text-[10px] text-muted-foreground">{d.month}</div>
                  </button>
                ))}
              </div>

              <h2 className="mt-6 mb-3 text-lg font-bold inline-flex items-center gap-2"><Clock className="h-5 w-5 text-gold" /> اختر الوقت</h2>
              {barberIsOffToday ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-200">
                  الحلاق ده مش متاح يوم <b>{dayLabelAr[dayKeyOfDate ?? ""] ?? ""}</b>. اختر يوم تاني أو اختر <button onClick={() => setBarberId("")} className="underline font-bold">أي حلاق متاح</button>.
                </div>
              ) : availableTimes.length === 0 ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-200">
                  لا يوجد أوقات تناسب مدة الخدمات ضمن ساعات عمل الحلاق في هذا اليوم.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {availableTimes.map((t) => {
                    const isTaken = takenTimes.includes(t);
                    return (
                      <button
                        key={t}
                        disabled={isTaken}
                        onClick={() => setTime(t)}
                        className={`rounded-lg border px-2 py-2 text-sm font-bold transition ${
                          isTaken
                            ? "cursor-not-allowed border-border/50 text-muted-foreground/40 line-through"
                            : time === t
                            ? "border-gold bg-gold-gradient text-gold-foreground shadow-gold"
                            : "border-border hover:border-gold/40"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}


          {step === 4 && (
            <div className="animate-fade-up">
              {referenceItem && (() => {
                const refMedia = (referenceItem as any).media?.slice().sort((a: any, b: any) => a.sort_order - b.sort_order)[0]
                  ?? { media_url: (referenceItem as any).media_url, thumbnail_url: (referenceItem as any).thumbnail_url, media_type: (referenceItem as any).media_type };
                const src = refMedia.thumbnail_url ?? refMedia.media_url;
                return (
                  <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-3">
                    <div className="relative shrink-0 h-20 w-20 rounded-xl overflow-hidden bg-black">
                      {refMedia.media_type === "video" && refMedia.thumbnail_url === null
                        ? <video src={refMedia.media_url} className="h-full w-full object-cover" muted playsInline />
                        : <img src={src} className="h-full w-full object-cover" alt="" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-gold">أنت طلبت هذا الشكل</div>
                      {(referenceItem as any).caption && <div className="mt-0.5 text-xs text-foreground/80 line-clamp-2">{(referenceItem as any).caption}</div>}
                      <div className="mt-1 text-[10px] text-muted-foreground">سيتم إرسال هذا المرجع للحلاق مع حجزك.</div>
                    </div>
                  </div>
                );
              })()}
              <h2 className="mb-4 text-lg font-bold">بياناتك للتواصل</h2>
              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">الاسم</span>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل"
                      className="w-full rounded-xl border border-border bg-input/40 px-10 py-3 text-sm outline-none focus:border-gold" />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">رقم الهاتف</span>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="٠١٠xxxxxxxx" inputMode="tel"
                      className="w-full rounded-xl border border-border bg-input/40 px-10 py-3 text-sm outline-none focus:border-gold" />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">ملاحظات (اختياري)</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="مثلاً: طول القصة، تفضيلات خاصة..."
                    className="w-full rounded-xl border border-border bg-input/40 px-4 py-3 text-sm outline-none focus:border-gold" />
                </label>
              </div>

              {/* Summary */}
              <div className="mt-6 rounded-2xl border border-gold/20 bg-gold/5 p-5">
                <h3 className="text-sm font-black text-gold mb-3 inline-flex items-center gap-2"><Scissors className="h-4 w-4" /> ملخص الحجز</h3>
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground mb-1">الخدمات المختارة</dt>
                    <dd>
                      <ul className="space-y-1">
                        {selectedServices.map((s) => (
                          <li key={s.id} className="flex items-center justify-between border-b border-gold/10 pb-1 last:border-0">
                            <span className="font-bold">{s.name} <span className="text-xs text-muted-foreground">({s.duration_minutes} د)</span></span>
                            <span className="font-black">{s.price_egp} ج.م</span>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">الحلاق</dt><dd className="font-bold">{selectedBarber?.name ?? "أي حلاق متاح"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">التاريخ</dt><dd className="font-bold">{date}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">الوقت</dt><dd className="font-bold">{time}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">المدة الإجمالية</dt><dd className="font-bold">{totalDuration} دقيقة</dd></div>
                  <div className="mt-2 flex justify-between border-t border-gold/20 pt-3">
                    <dt className="font-bold">الإجمالي</dt>
                    <dd className="font-black text-gold-gradient">{totalPrice} ج.م</dd>
                  </div>
                  {depositActive && (
                    <div className="flex justify-between text-xs">
                      <dt className="text-muted-foreground">عربون مطلوب</dt>
                      <dd className="font-bold text-amber-400">{depositAmount} ج.م</dd>
                    </div>
                  )}
                </dl>
              </div>

              {!user && (
                <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 p-4 text-sm">
                  يمكنك إتمام الحجز كضيف بدون تسجيل دخول. الحساب مطلوب فقط للمزايا والباقات وتتبع الحجوزات.
                </div>
              )}
            </div>
          )}

          {step === 5 && depositActive && (
            <div className="animate-fade-up">
              <h2 className="mb-2 text-lg font-bold inline-flex items-center gap-2"><Wallet className="h-5 w-5 text-gold" /> دفع العربون</h2>
              <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                مطلوب دفع عربون <b>{depositAmount} ج.م</b> لتأكيد الحجز (يُخصم من إجمالي الفاتورة).
              </p>

              <h3 className="mb-2 text-sm font-black">اختر وسيلة الدفع</h3>
              {methods.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  لا توجد وسائل دفع مفعّلة. تواصل مع الإدارة.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {methods.map((m: any) => {
                    const active = methodId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setMethodId(m.id)}
                        className={`cursor-pointer rounded-2xl border p-4 transition ${active ? "border-gold bg-gold/10 shadow-gold" : "border-border hover:border-gold/40"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            {m.logo_url ? (
                              <img src={m.logo_url} alt={m.name} className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" />
                            ) : (
                              <div className="grid h-10 w-10 place-items-center rounded-lg bg-gold/10 text-gold text-[10px] font-black shrink-0">{m.name.slice(0,2)}</div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold truncate">{m.name}</div>
                              {m.provider && <div className="text-xs text-muted-foreground truncate">{m.provider}</div>}
                            </div>
                          </div>
                          <div className={`grid h-5 w-5 place-items-center rounded-full border-2 shrink-0 ${active ? "border-gold bg-gold-gradient" : "border-border"}`}>
                            {active && <Check className="h-3 w-3 text-gold-foreground" />}
                          </div>
                        </div>
                        {m.account_info && (
                          <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface-elevated px-3 py-2">
                            <code className="flex-1 font-mono text-xs break-all">{m.account_info}</code>
                            <button type="button" onClick={(e) => { e.stopPropagation(); copyText(m.account_info); }}
                              className="rounded-md border border-border p-1.5 hover:bg-accent" title="نسخ">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        {m.instructions && <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line">{m.instructions}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">رقم الهاتف الذي حوّلت منه</span>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="٠١xxxxxxxxx" inputMode="tel"
                      className="w-full rounded-xl border border-border bg-input/40 px-10 py-3 text-sm outline-none focus:border-gold" />
                  </div>
                </label>

                <div>
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">صورة إثبات التحويل</span>
                  {proofUrl ? (
                    <div className="relative overflow-hidden rounded-2xl border border-gold/20">
                      <img src={proofUrl} alt="إثبات الدفع" className="max-h-64 w-full object-contain bg-black/20" />
                      <button type="button" onClick={() => setProofUrl("")}
                        className="absolute top-2 left-2 rounded-full bg-destructive/90 p-1.5 text-destructive-foreground">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <MediaUploadField
                      accept="image/*"
                      aspect="aspect-video"
                      folder="payment-proofs"
                      label="ارفع صورة سكرين شوت التحويل"
                      onUploaded={({ url }) => setProofUrl(url)}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold disabled:opacity-40"
            >
              السابق
            </button>
            {step < lastStep ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 1 && serviceIds.length === 0) ||
                  (step === 3 && (!date || !time)) ||
                  (step === 4 && (!name.trim() || !phone.trim()))
                }
                className="inline-flex items-center gap-1 rounded-xl bg-gold-gradient px-6 py-2.5 text-sm font-black text-gold-foreground shadow-gold disabled:opacity-40"
              >
                التالي <ChevronLeft className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={depositActive ? submitWithDeposit : submitWithoutDeposit}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-xl bg-gold-gradient px-6 py-2.5 text-sm font-black text-gold-foreground shadow-gold disabled:opacity-60"
              >
                {submitting ? "جارٍ الإرسال..." : depositActive ? "إرسال وتأكيد الحجز" : "تأكيد الحجز"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sticky summary */}
      {selectedServices.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t border-gold/20 bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 text-xs sm:text-sm">
              <div className="font-black text-gold">
                {selectedServices.length} خدمة • {totalDuration} د
              </div>
              <div className="text-muted-foreground truncate">
                {selectedServices.map((s) => s.name).join(" • ")}
              </div>
            </div>
            <div className="shrink-0 text-lg font-black text-gold-gradient">{totalPrice} ج.م</div>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
