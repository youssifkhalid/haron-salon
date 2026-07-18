
-- PROMOTIONS
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL CHECK (discount_value >= 0),
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
  starts_at timestamptz, ends_at timestamptz,
  max_uses int, uses_count int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT SELECT ON public.promotions TO anon;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo public read active" ON public.promotions FOR SELECT USING (is_active = true);
CREATE POLICY "promo admin all" ON public.promotions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER promotions_touch BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, category text,
  amount_egp numeric NOT NULL CHECK (amount_egp >= 0),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  is_debt boolean NOT NULL DEFAULT false, paid boolean NOT NULL DEFAULT true,
  notes text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses admin all" ON public.expenses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER expenses_touch BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- SUBSCRIPTION PLANS
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text,
  price_egp numeric NOT NULL CHECK (price_egp >= 0),
  sessions_included int NOT NULL CHECK (sessions_included >= 0),
  duration_days int NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  is_active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.subscription_plans TO anon;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public read active" ON public.subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY "plans admin all" ON public.subscription_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER plans_touch BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- CUSTOMER SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  starts_on date NOT NULL DEFAULT CURRENT_DATE, ends_on date NOT NULL,
  sessions_used int NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_subscriptions TO authenticated;
GRANT ALL ON public.customer_subscriptions TO service_role;
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs self read" ON public.customer_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "subs admin all" ON public.customer_subscriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER subs_touch BEFORE UPDATE ON public.customer_subscriptions FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY, actor_id uuid,
  action text NOT NULL, entity_type text NOT NULL, entity_id text,
  meta jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- LOYALTY
CREATE TABLE IF NOT EXISTS public.customer_points (
  user_id uuid PRIMARY KEY, balance int NOT NULL DEFAULT 0, lifetime int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_points TO authenticated;
GRANT ALL ON public.customer_points TO service_role;
ALTER TABLE public.customer_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points self read" ON public.customer_points FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "points admin all" ON public.customer_points FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  delta int NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.points_transactions TO authenticated;
GRANT ALL ON public.points_transactions TO service_role;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ptx self read" ON public.points_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ptx admin insert" ON public.points_transactions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

-- BLACKOUT DATES
CREATE TABLE IF NOT EXISTS public.blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blackout_date date NOT NULL UNIQUE, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blackout_dates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blackout_dates TO authenticated;
GRANT ALL ON public.blackout_dates TO service_role;
ALTER TABLE public.blackout_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blackout public read" ON public.blackout_dates FOR SELECT USING (true);
CREATE POLICY "blackout admin all" ON public.blackout_dates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- WAITLIST
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
  customer_name text NOT NULL, customer_phone text NOT NULL,
  desired_date date NOT NULL, desired_time time,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
  notes text,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','contacted','booked','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wait self read" ON public.waitlist FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "wait insert" ON public.waitlist FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "wait admin all" ON public.waitlist FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- CUSTOMER EXT
CREATE TABLE IF NOT EXISTS public.customer_profiles_ext (
  user_id uuid PRIMARY KEY, is_vip boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false, admin_notes text,
  tags text[] DEFAULT ARRAY[]::text[], updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_profiles_ext TO authenticated;
GRANT ALL ON public.customer_profiles_ext TO service_role;
ALTER TABLE public.customer_profiles_ext ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpx admin all" ON public.customer_profiles_ext FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- PAYMENT METHODS
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, provider text, account_info text, instructions text,
  is_active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_methods TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm public read active" ON public.payment_methods FOR SELECT USING (is_active = true);
CREATE POLICY "pm admin all" ON public.payment_methods FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER pm_touch BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- PAYMENT PROOFS
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  amount_egp numeric NOT NULL, image_url text, reference text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_proofs TO authenticated;
GRANT ALL ON public.payment_proofs TO service_role;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp self read" ON public.payment_proofs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pp insert self" ON public.payment_proofs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "pp admin all" ON public.payment_proofs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER pp_touch BEFORE UPDATE ON public.payment_proofs FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- NOTIFICATION TEMPLATES + LOG
CREATE TABLE IF NOT EXISTS public.notification_templates (
  key text PRIMARY KEY, label text NOT NULL,
  channel text NOT NULL DEFAULT 'inapp' CHECK (channel IN ('inapp','email','sms','whatsapp')),
  subject text, body text NOT NULL, is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nt admin all" ON public.notification_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER nt_touch BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.notifications_log (
  id bigserial PRIMARY KEY, template_key text, channel text,
  recipient text, subject text, body text,
  status text NOT NULL DEFAULT 'queued', meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notifications_log TO authenticated;
GRANT ALL ON public.notifications_log TO service_role;
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nlog admin all" ON public.notifications_log FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- CONTENT PAGES
CREATE TABLE IF NOT EXISTS public.content_pages (
  slug text PRIMARY KEY, title text NOT NULL, body text NOT NULL DEFAULT '',
  seo_title text, seo_description text, is_published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.content_pages TO authenticated;
GRANT ALL ON public.content_pages TO service_role;
ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp public read" ON public.content_pages FOR SELECT USING (is_published = true);
CREATE POLICY "cp admin all" ON public.content_pages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER cp_touch BEFORE UPDATE ON public.content_pages FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- BANNERS
CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message text NOT NULL,
  variant text NOT NULL DEFAULT 'info' CHECK (variant IN ('info','warning','success','promo')),
  link_url text, starts_at timestamptz, ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banner public read active" ON public.banners FOR SELECT USING (is_active = true);
CREATE POLICY "banner admin all" ON public.banners FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER banners_touch BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- CONTACT MESSAGES
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  phone text, email text, subject text, message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false, is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm anyone insert" ON public.contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "cm admin all" ON public.contact_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ADMIN LOGIN LOG
CREATE TABLE IF NOT EXISTS public.admin_login_log (
  id bigserial PRIMARY KEY, user_id uuid, event text NOT NULL,
  user_agent text, ip text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_login_log TO authenticated;
GRANT ALL ON public.admin_login_log TO service_role;
ALTER TABLE public.admin_login_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all self insert" ON public.admin_login_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "all admin read" ON public.admin_login_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ADMIN PERMISSIONS
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  user_id uuid NOT NULL, permission text NOT NULL, granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm self read" ON public.admin_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "perm admin all" ON public.admin_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = _user_id AND permission = _permission)
      OR public.has_role(_user_id, 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid,text) TO anon, authenticated;

-- POS TRANSACTIONS (كاشير عبر admin_permissions permission='cashier')
CREATE TABLE IF NOT EXISTS public.pos_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id uuid, booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_name text, customer_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_egp numeric NOT NULL DEFAULT 0,
  discount_egp numeric NOT NULL DEFAULT 0,
  total_egp numeric NOT NULL DEFAULT 0,
  payment_method text, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_transactions TO authenticated;
GRANT ALL ON public.pos_transactions TO service_role;
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos cashier all" ON public.pos_transactions FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'cashier')) WITH CHECK (public.has_permission(auth.uid(),'cashier'));

-- SEED DATA
INSERT INTO public.notification_templates (key,label,channel,subject,body) VALUES
  ('booking_created','تأكيد استلام الحجز','inapp','تم استلام حجزك','شكراً {name}! تم استلام حجزك يوم {date} الساعة {time}. سنؤكده قريباً.'),
  ('booking_confirmed','تأكيد الحجز','inapp','تم تأكيد حجزك','مرحباً {name}، تم تأكيد حجزك يوم {date} الساعة {time}.'),
  ('booking_cancelled','إلغاء الحجز','inapp','تم إلغاء حجزك','عذراً {name}، تم إلغاء حجزك يوم {date}.'),
  ('booking_reminder','تذكير بالموعد','inapp','تذكير بموعدك','تذكير: موعدك غداً {date} الساعة {time}.'),
  ('subscription_ending','انتهاء الاشتراك','inapp','اشتراكك على وشك الانتهاء','اشتراكك ينتهي في {date}.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.payment_methods (name,provider,account_info,instructions,sort_order) VALUES
  ('فودافون كاش','vodafone_cash','01000000000','حوّل المبلغ وأرسل صورة الإثبات.',1),
  ('انستاباي','instapay','haroun@instapay','حوّل عبر انستاباي.',2),
  ('نقدي في الصالون','cash','—','ادفع نقداً عند وصولك.',3);

INSERT INTO public.content_pages (slug,title,body,seo_title,seo_description) VALUES
  ('about','من نحن','صالون هارون — تجربة حلاقة كلاسيكية بلمسة عصرية.','من نحن — صالون هارون','تعرّف على صالون هارون وقصتنا.'),
  ('terms','الشروط والأحكام','شروط استخدام خدمات الصالون.','الشروط والأحكام — صالون هارون',NULL),
  ('privacy','سياسة الخصوصية','نحن نحترم خصوصيتك.','سياسة الخصوصية — صالون هارون',NULL),
  ('faq','الأسئلة الشائعة','كيف أحجز؟ من صفحة الحجز.\nهل يمكن الإلغاء؟ نعم قبل الموعد بـ 3 ساعات.','الأسئلة الشائعة — صالون هارون',NULL)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.site_settings (key,value,description,is_public) VALUES
  ('booking_policy','{"min_lead_minutes":120,"buffer_minutes":15,"max_daily_per_barber":20,"cancel_window_hours":3}'::jsonb,'قواعد الحجز',true),
  ('loyalty','{"enabled":false,"points_per_egp":1,"redeem_ratio":100}'::jsonb,'إعدادات الولاء',true)
ON CONFLICT (key) DO NOTHING;
