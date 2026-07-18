import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, Clock, User, Phone, X, Scissors, Settings, LayoutGrid,
  TrendingUp, CircleDollarSign, Sparkles, LogOut, Save, Loader2, Lock, ShieldCheck, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useAuth } from "@/lib/auth";
import { myBookingsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SingleImageUpload } from "@/components/site/MediaUploadField";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "حسابي — صالون هارون" }, { name: "robots", content: "noindex" }] }),
  component: AccountPage,
});

const statusLabel: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "بانتظار مراجعة الدفع", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  pending: { label: "بانتظار التأكيد", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  confirmed: { label: "مؤكد", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  completed: { label: "مكتمل", cls: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  cancelled: { label: "ملغي", cls: "bg-rose-500/10 text-rose-300 border-rose-500/30" },
  no_show: { label: "لم يحضر", cls: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30" },
};

function AccountPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/account" } });
  }, [loading, user, navigate]);

  if (!user) return null;

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 animate-fade-in">
        <AccountHeader user={user} />
        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="w-full grid grid-cols-4 h-auto p-1">
            <TabsTrigger value="overview" className="gap-1.5"><LayoutGrid className="h-4 w-4" /><span className="hidden sm:inline">نظرة عامة</span></TabsTrigger>
            <TabsTrigger value="bookings" className="gap-1.5"><CalendarCheck className="h-4 w-4" /><span className="hidden sm:inline">حجوزاتي</span></TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5"><User className="h-4 w-4" /><span className="hidden sm:inline">الملف الشخصي</span></TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-4 w-4" /><span className="hidden sm:inline">الإعدادات</span></TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6"><OverviewTab userId={user.id} /></TabsContent>
          <TabsContent value="bookings" className="mt-6"><BookingsTab userId={user.id} /></TabsContent>
          <TabsContent value="profile" className="mt-6"><ProfileTab userId={user.id} email={user.email ?? ""} /></TabsContent>
          <TabsContent value="settings" className="mt-6"><SettingsTab email={user.email ?? ""} /></TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}

function AccountHeader({ user }: { user: any }) {
  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });
  const name = profile?.full_name || user.email?.split("@")[0] || "عميلنا";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/15 bg-surface-elevated">
      <div className="h-28 sm:h-36 bg-gold-gradient/40" />
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-14 px-6 pb-6 relative">
        <div className="relative shrink-0">
          <div className="absolute -inset-1 rounded-2xl bg-gold-gradient opacity-60 blur-md animate-pulse" />
          <div className="relative h-24 w-24 rounded-2xl overflow-hidden border-4 border-surface-elevated bg-gold-gradient grid place-items-center text-4xl font-black text-gold-foreground shadow-gold">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" /> : initial}
          </div>
        </div>
        <div className="flex-1 pt-2 min-w-0">
          <div className="text-xs font-bold text-gold tracking-widest">حسابي</div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-black truncate">مرحباً {name}</h1>
          <div className="text-xs text-muted-foreground truncate" dir="ltr">{user.email}</div>
        </div>
        <Link to="/booking" className="inline-flex items-center gap-2 rounded-xl bg-gold-gradient px-5 py-2.5 text-sm font-black text-gold-foreground shadow-gold hover:brightness-110 transition">
          <CalendarCheck className="h-4 w-4" /> حجز جديد
        </Link>
      </div>
    </div>
  );
}

/* ==================== OVERVIEW ==================== */
function OverviewTab({ userId }: { userId: string }) {
  const { data: bookings = [] } = useQuery(myBookingsQuery(userId));
  const { data: points } = useQuery({
    queryKey: ["customer-points", userId],
    queryFn: async () => {
      const { data } = await supabase.from("customer_points").select("*").eq("user_id", userId).maybeSingle();
      return data;
    },
  });

  const stats = useMemo(() => {
    const total = bookings.length;
    const completed = bookings.filter((b: any) => b.status === "completed").length;
    const upcoming = bookings.filter((b: any) => (b.status === "confirmed" || b.status === "pending" || b.status === "pending_payment") && b.booking_date >= new Date().toISOString().slice(0,10)).length;
    const spent = bookings.filter((b: any) => b.status === "completed").reduce((s: number, b: any) => s + Number(b.price_egp || 0), 0);
    const svc: Record<string, number> = {};
    for (const b of bookings) {
      const n = b.services?.name ?? (b.booking_services?.[0]?.services?.name ?? null);
      if (n) svc[n] = (svc[n] ?? 0) + 1;
    }
    const fav = Object.entries(svc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { total, completed, upcoming, spent, fav };
  }, [bookings]);

  const nextBooking = bookings
    .filter((b: any) => (b.status === "confirmed" || b.status === "pending") && b.booking_date >= new Date().toISOString().slice(0,10))
    .sort((a: any, b: any) => (a.booking_date + a.booking_time).localeCompare(b.booking_date + b.booking_time))[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<CalendarCheck className="h-5 w-5" />} label="إجمالي الزيارات" value={stats.total} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="زيارات مكتملة" value={stats.completed} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="حجوزات قادمة" value={stats.upcoming} accent />
        <StatCard icon={<CircleDollarSign className="h-5 w-5" />} label="إجمالي الإنفاق" value={`${stats.spent} ج.م`} textual />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gold/15 bg-card p-5">
          <div className="text-sm font-bold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold" /> موعدك القادم</div>
          {nextBooking ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-center min-w-[80px] rounded-xl bg-gold/10 py-3 px-4">
                <div className="text-xs text-muted-foreground">{nextBooking.booking_date}</div>
                <div className="font-black text-gold text-lg" dir="ltr">{String(nextBooking.booking_time).slice(0,5)}</div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="font-bold">{nextBooking.services?.name ?? nextBooking.booking_services?.[0]?.services?.name ?? "خدمة"}</div>
                <div className="text-xs text-muted-foreground mt-1">مع {nextBooking.barbers?.name ?? "أي حلاق"}</div>
              </div>
              <div className="text-xl font-black text-gold-gradient">{nextBooking.price_egp} <span className="text-xs text-muted-foreground">ج.م</span></div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <div className="text-sm text-muted-foreground">لا يوجد موعد قادم</div>
              <Link to="/booking" className="mt-3 inline-block rounded-lg bg-gold-gradient px-4 py-2 text-sm font-bold text-gold-foreground">احجز الآن</Link>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gold/15 bg-gold/5 p-5">
          <div className="text-xs text-muted-foreground">نقاط الولاء</div>
          <div className="mt-2 font-display text-4xl font-black text-gold">{points?.points_balance ?? 0}</div>
          <div className="mt-1 text-xs text-muted-foreground">اكسب نقاط مع كل حجز مكتمل</div>
          {stats.fav !== "—" && (
            <div className="mt-4 pt-4 border-t border-gold/20 text-xs">
              <span className="text-muted-foreground">خدمتك المفضلة: </span>
              <span className="font-bold text-gold">{stats.fav}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent, textual }: { icon: React.ReactNode; label: string; value: any; accent?: boolean; textual?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 transition hover:border-gold/40 ${accent ? "border-gold/30 bg-gold/5" : "border-gold/10 bg-card"}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <span className="text-gold">{icon}</span>
      </div>
      <div className={`mt-2 font-display font-black ${textual ? "text-lg" : "text-2xl"} ${accent ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}

/* ==================== BOOKINGS ==================== */
function BookingsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: bookings = [], isLoading } = useQuery(myBookingsQuery(userId));
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  async function cancel(id: string) {
    if (!confirm("هل أنت متأكد من إلغاء الحجز؟")) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إلغاء الحجز");
    qc.invalidateQueries({ queryKey: ["bookings"] });
  }

  const today = new Date().toISOString().slice(0,10);
  const filtered = bookings.filter((b: any) => {
    const isUpcoming = b.status !== "cancelled" && b.status !== "completed" && b.status !== "no_show" && b.booking_date >= today;
    if (filter === "upcoming") return isUpcoming;
    if (filter === "past") return !isUpcoming;
    return true;
  });

  if (isLoading) return <div className="rounded-2xl border border-border bg-surface/50 p-8 text-center text-sm text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="upcoming">القادمة</TabsTrigger>
          <TabsTrigger value="past">السابقة</TabsTrigger>
          <TabsTrigger value="all">الكل</TabsTrigger>
        </TabsList>
      </Tabs>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Scissors className="mx-auto h-8 w-8 text-gold" />
          <p className="mt-3 text-sm text-muted-foreground">لا توجد حجوزات هنا.</p>
          <Link to="/booking" className="mt-4 inline-block rounded-lg bg-gold-gradient px-4 py-2 text-sm font-bold text-gold-foreground">احجز الآن</Link>
        </div>
      ) : (
        <div className="grid gap-3">{filtered.map((b: any) => <BookingCard key={b.id} b={b} onCancel={cancel} />)}</div>
      )}
    </div>
  );
}

function BookingCard({ b, onCancel }: { b: any; onCancel?: (id: string) => void }) {
  const s = statusLabel[b.status] ?? { label: b.status, cls: "" };
  const services = (b.booking_services ?? []).map((bs: any) => bs.services?.name).filter(Boolean);
  const primaryTitle = services.length > 0 ? services.join(" + ") : (b.services?.name ?? "خدمة");
  const proof = Array.isArray(b.payment_proofs) ? b.payment_proofs[0] : null;
  const proofLabel: Record<string, { text: string; cls: string }> = {
    pending: { text: "بانتظار مراجعة الدفع", cls: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
    approved: { text: "تم تأكيد الدفع", cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
    rejected: { text: "تم رفض إثبات الدفع — تواصل معنا", cls: "text-rose-300 border-rose-500/30 bg-rose-500/10" },
  };
  const pl = proof ? proofLabel[proof.status] : null;
  const canCancel = onCancel && b.status !== "cancelled" && b.status !== "completed" && b.status !== "no_show";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-gold/10 bg-card p-4 sm:p-5 transition hover:border-gold/40 animate-fade-in">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-black">{primaryTitle}</h3>
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>
          {pl && <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${pl.cls}`}>{pl.text}</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarCheck className="h-3.5 w-3.5" /> {b.booking_date}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {String(b.booking_time).slice(0,5)}</span>
          <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {b.barbers?.name ?? "أي حلاق"}</span>
          <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {b.customer_phone}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="text-lg font-black text-gold-gradient">{b.price_egp} <span className="text-xs text-muted-foreground">ج.م</span></div>
        {canCancel && (
          <button onClick={() => onCancel!(b.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-rose-500/10">
            <X className="h-3.5 w-3.5" /> إلغاء
          </button>
        )}
      </div>
    </div>
  );
}

/* ==================== PROFILE ==================== */
function ProfileTab({ userId, email }: { userId: string; email: string }) {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setAvatar(profile.avatar_url ?? "");
    }
  }, [profile]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      avatar_url: avatar || null,
    }).eq("id", userId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ الملف الشخصي");
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  }

  if (isLoading) return <div className="rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5 rounded-2xl border border-gold/10 bg-card p-5">
        <div>
          <Label className="mb-2 block">الصورة الشخصية</Label>
          <div className="max-w-[180px]">
            <SingleImageUpload value={avatar} onChange={setAvatar} aspect="aspect-square" label="ارفع صورتك" />
          </div>
        </div>
        <div>
          <Label>الاسم الكامل</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="اسمك الكامل" className="mt-1" />
        </div>
        <div>
          <Label>رقم الهاتف</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01012345678" dir="ltr" className="mt-1" />
        </div>
        <div>
          <Label>البريد الإلكتروني</Label>
          <Input value={email} readOnly disabled dir="ltr" className="mt-1 bg-muted/30" />
          <p className="mt-1 text-xs text-muted-foreground">لتغيير البريد، تواصل مع الإدارة.</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-gold-gradient text-gold-foreground shadow-gold hover:brightness-110">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ التغييرات
        </Button>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-gold/10 bg-gold/5 p-5 text-sm">
          <div className="flex items-center gap-2 font-bold text-gold"><Sparkles className="h-4 w-4" /> نصيحة</div>
          <p className="mt-2 text-muted-foreground text-xs leading-relaxed">
            ملف كامل يساعدنا في تقديم خدمة أفضل ويسهّل التواصل معك لتأكيد الحجوزات.
          </p>
        </div>
        <div className="rounded-2xl border border-gold/10 bg-card p-5 text-xs space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            <span>معلوماتك آمنة ولن نشاركها مع أي طرف ثالث.</span>
          </div>
          {profile?.created_at && (
            <div className="text-muted-foreground pt-2 border-t border-border/50">
              عضو منذ: <span className="text-foreground font-bold">{new Date(profile.created_at).toLocaleDateString("ar-EG")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== SETTINGS ==================== */
function SettingsTab({ email }: { email: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [changing, setChanging] = useState(false);

  async function changePassword() {
    if (pw.length < 6) { toast.error("كلمة المرور 6 حروف على الأقل"); return; }
    if (pw !== pw2) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    setChanging(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setChanging(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تغيير كلمة المرور");
    setPw(""); setPw2("");
  }

  async function resetPasswordEmail() {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("أُرسل رابط إعادة التعيين إلى بريدك");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-gold/10 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 font-bold"><Lock className="h-4 w-4 text-gold" /> تغيير كلمة المرور</div>
        <div>
          <Label>كلمة مرور جديدة</Label>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="6 حروف على الأقل" className="mt-1" />
        </div>
        <div>
          <Label>تأكيد كلمة المرور</Label>
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="mt-1" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={changePassword} disabled={changing || !pw} className="bg-gold-gradient text-gold-foreground shadow-gold hover:brightness-110">
            {changing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
          </Button>
          <Button variant="outline" onClick={resetPasswordEmail}>
            <Mail className="h-4 w-4" /> إرسال رابط إعادة تعيين
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 space-y-4">
        <div className="flex items-center gap-2 font-bold text-rose-400"><LogOut className="h-4 w-4" /> منطقة الخطر</div>
        <div className="text-sm text-muted-foreground">تسجيل الخروج من هذا الجهاز. لن يؤثر على حجوزاتك.</div>
        <Button variant="outline" onClick={signOut} className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
