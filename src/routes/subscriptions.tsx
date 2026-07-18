import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles, Upload } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { subscriptionPlansQuery, activePaymentMethodsQuery } from "@/lib/queries";
import { ImageUploadField } from "@/components/admin/EntityDialog";

export const Route = createFileRoute("/subscriptions")({
  loader: ({ context }) => context.queryClient.ensureQueryData(subscriptionPlansQuery()),
  head: () => ({
    meta: [
      { title: "باقات الاشتراك — صالون هارون" },
      { name: "description", content: "اشترك في باقات صالون هارون الشهرية ووفّر على خدماتك المفضلة." },
      { property: "og:title", content: "باقات الاشتراك — صالون هارون" },
      { property: "og:description", content: "باقات شهرية بأسعار موفّرة على قص الشعر وتهذيب اللحية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const { data: plans = [] } = useSuspenseQuery(subscriptionPlansQuery());
  const active = plans.filter((p: any) => p.is_active);
  const [subPlan, setSubPlan] = useState<any | null>(null);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <header className="max-w-2xl animate-fade-in">
          <div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.35em] text-gold">
            <Sparkles className="h-3.5 w-3.5" /> باقاتنا
          </div>
          <h1 className="mt-3 font-display text-4xl font-black sm:text-5xl">اشتراكات موفّرة، خدمة استثنائية</h1>
          <p className="mt-4 text-muted-foreground">اختر الباقة المناسبة لك ووفّر على زياراتك الشهرية للصالون.</p>
        </header>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((p: any, i: number) => (
            <div key={p.id} className="group animate-fade-in overflow-hidden rounded-2xl border border-gold/10 bg-card transition hover:border-gold/40 hover:shadow-gold" style={{ animationDelay: `${i * 60}ms` }}>
              {p.image_url ? (
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                </div>
              ) : (
                <div className="aspect-[16/10] bg-gold-gradient/20 grid place-items-center">
                  <Sparkles className="h-12 w-12 text-gold" />
                </div>
              )}
              <div className="p-6">
                <h3 className="font-display text-xl font-black">{p.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-gold-gradient">{p.price_egp}</span>
                  <span className="text-sm text-muted-foreground">ج.م / {p.duration_days} يوم</span>
                </div>
                <div className="mt-1 text-sm font-bold text-gold">{p.sessions_included} جلسة مشمولة</div>
                {p.description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{p.description}</p>}
                {Array.isArray(p.features) && p.features.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {p.features.map((f: string, k: number) => (
                      <li key={k} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button onClick={() => setSubPlan(p)} className="mt-6 w-full bg-gold-gradient text-gold-foreground hover:brightness-110">اشترك الآن</Button>
              </div>
            </div>
          ))}
          {active.length === 0 && <div className="col-span-full p-12 text-center text-muted-foreground">لا توجد باقات متاحة حالياً.</div>}
        </div>
      </div>

      {subPlan && <SubscribeDialog plan={subPlan} onClose={() => setSubPlan(null)} />}
    </SiteLayout>
  );
}

function SubscribeDialog({ plan, onClose }: { plan: any; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: methods = [] } = useQuery(activePaymentMethodsQuery());
  const [receiptUrl, setReceiptUrl] = useState("");
  const [sender, setSender] = useState("");
  const [methodId, setMethodId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>سجّل دخول لإتمام الاشتراك</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">الاشتراك في الباقات يتطلّب حساباً لمتابعة عدد الجلسات المتبقية.</p>
          <Button onClick={() => navigate({ to: "/auth", search: { redirect: "/subscriptions" } as any })} className="bg-gold-gradient text-gold-foreground">تسجيل الدخول</Button>
        </DialogContent>
      </Dialog>
    );
  }

  async function submit() {
    if (!receiptUrl) { toast.error("ارفع صورة الإيصال"); return; }
    if (!sender.trim()) { toast.error("أدخل رقم التحويل"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase.from as any)("subscription_requests").insert({
        user_id: user!.id, plan_id: plan.id,
        receipt_url: receiptUrl, sender_phone: sender.trim(),
        amount_egp: plan.price_egp,
      });
      if (error) throw error;
      toast.success("تم إرسال طلب الاشتراك. سيؤكّده الأدمن قريباً.");
      onClose();
      navigate({ to: "/account" });
    } catch (e: any) {
      toast.error(e?.message ?? "خطأ");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>الاشتراك في {plan.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-gold/20 bg-gold/5 p-3">
            <div className="text-sm">المبلغ المطلوب</div>
            <div className="text-2xl font-black text-gold">{plan.price_egp} ج.م</div>
          </div>

          <div>
            <div className="mb-2 text-sm font-bold">حوّل المبلغ لأحد الوسائل التالية:</div>
            <div className="space-y-2">
              {methods.map((m: any) => (
                <button key={m.id} onClick={() => setMethodId(m.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-right transition ${methodId === m.id ? "border-gold bg-gold/10" : "border-border hover:bg-accent/40"}`}>
                  {m.logo_url ? <img src={m.logo_url} alt={m.name} className="h-10 w-10 rounded-lg object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-lg bg-gold/10 text-gold text-xs font-bold">{m.name.slice(0,2)}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{m.name}</div>
                    {m.account_info && <div className="font-mono text-xs text-muted-foreground truncate">{m.account_info}</div>}
                  </div>
                </button>
              ))}
              {methods.length === 0 && <div className="text-xs text-muted-foreground">لم تُضاف وسائل دفع بعد.</div>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold">رقم التحويل (من عندك)</label>
            <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="01xxxxxxxxx" dir="ltr" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> صورة إيصال التحويل</label>
            <ImageUploadField value={receiptUrl} onChange={setReceiptUrl} required />
          </div>

          <Button onClick={submit} disabled={saving} className="w-full bg-gold-gradient text-gold-foreground">
            {saving ? "جارٍ الإرسال..." : "إرسال طلب الاشتراك"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
