## المرحلة 1 — التدقيق (Audit) وإكمال النواقص

سأراجع اللوحة الحالية وأصلح النواقص التالية قبل التوسع:

| البند | الحالة الحالية | الإجراء |
|---|---|---|
| نظرة عامة (Dashboard) | منفّذ | تحسين + Heatmap |
| الصنايعية | منفّذ | لا شيء |
| الخدمات والأسعار | منفّذ | لا شيء |
| الخصومات والعروض | **غير منفّذ** | إنشاء جدول + واجهة |
| الأدوار | منفّذ جزئي (admin/staff/customer فقط) | إضافة "cashier" + صلاحيات دقيقة |
| المصاريف والديون | **غير منفّذ** | جدول + واجهة |
| التقارير المالية | منفّذ جزئي (KPIs فقط) | رسوم + فلترة + تصدير |
| ساعات العمل + إجازات | جزئي (site_settings) | جدول blackout_dates + محرر |
| الاشتراكات الشهرية | **غير منفّذ** | جداول subscriptions + plans |
| Audit Log | **غير منفّذ** | جدول + trigger + عرض |
| الوسائط والمظهر | منفّذ (gallery + settings) | إضافة تحكم في اللوجو/البانر/الهيرو من DB |
| الكاشير + تقارير | **غير منفّذ** | جدول transactions/pos |
| مراجعة/تأكيد الحجوزات وإثباتات الدفع | جزئي | إضافة payment_proof + workflow |

## المرحلة 2 — الميزات الجديدة (15 قسم إلزامي)

### قاعدة البيانات (Migrations)
جداول جديدة:
- `promotions` (خصومات: نسبة/ثابت، نطاق، تفعيل)
- `expenses` (مصاريف/ديون)
- `subscription_plans` + `customer_subscriptions`
- `audit_log` (كل عملية حساسة)
- `loyalty_settings` + `customer_points` + `points_transactions`
- `booking_policies` (buffer, min-lead, cancel window, daily cap)
- `blackout_dates`
- `waitlist`
- `customer_notes` + `customer_flags` (VIP/blocked) — عبر جدول `customer_profiles_ext`
- `payment_methods` (مرن قابل للتعديل)
- `payment_proofs` (لحجوزات)
- `notification_templates` + `notifications_log`
- `content_pages` (About/Terms/Privacy/FAQ)
- `banners` (إعلان عام مع تواريخ)
- `contact_messages` (صندوق وارد)
- `admin_login_log`
- `admin_permissions` (Granular per-user)
- `pos_transactions` (كاشير)

كل الجداول: RLS + GRANT + policies للأدمن، + `has_permission()` function.

### الواجهة (Admin UI)
إعادة تنظيم `admin.tsx` بتبويبات جانبية موسعة، بحث عام أعلى اللوحة، وأقسام:
1. Bookings+ (bulk, manual create, waitlist, reschedule)
2. CRM (قاعدة عملاء، ملف كامل، ملاحظات، VIP/حظر، تصدير CSV)
3. Content (About/Terms/Privacy/FAQ/SEO محرر)
4. Notification Templates
5. Booking Policies (buffer, min-lead, blackout dates)
6. Loyalty (تفعيل، rules، عرض نقاط عميل)
7. Reviews (موجود — تحسين رد الأدمن)
8. Payment Methods (CRUD + تفعيل مؤقت)
9. Granular Permissions (per-user checkboxes)
10. Security Log + Force Logout + 2FA toggle
11. Reports Center (Excel/PDF export, Heatmap, No-Show)
12. Banners (مع بدء/انتهاء)
13. Inbox (رسائل التواصل)
14. Global Search + Pin sections (localStorage per-admin)
15. Backup Export (JSON كامل)

### مكوّنات مشتركة جديدة
- `<GlobalAdminSearch />` — بحث موحد
- `<ExportButton csv|json|xlsx />`
- `<HeatmapChart />` باستخدام recharts
- `<PermissionGate permission="..." />`
- `<RichTextArea />` (textarea محسّن للقوالب/المحتوى)

### تصدير Excel/PDF
استخدام مكتبات خفيفة: `xlsx` للتصدير + `jspdf` + `jspdf-autotable` للـ PDF.

### الأمان
- كل الجداول RLS + `admins manage all` + سياسات ضيقة للعميل
- Audit trigger على العمليات الحساسة (roles, expenses, bookings)
- تحقق `has_role('admin')` قبل أي كتابة إدارية
- سجل دخول admin عبر trigger على auth events (client-side capture)

## خطة التنفيذ التقنية

```text
1) Migration واحد كبير: كل الجداول + RLS + GRANTs + functions + triggers
2) بذر بيانات افتراضية: policies, notification_templates, payment_methods, content_pages
3) توسيع src/lib/queries.ts لكل الجداول الجديدة
4) بناء مكوّنات مشتركة (Export, Heatmap, Search, PermissionGate)
5) إعادة هيكلة src/routes/admin.tsx إلى ملفات فرعية تحت src/components/admin/sections/*
6) ربط Content Pages بالصفحات العامة (about/terms/privacy/faq)
7) ربط Banners بالـ Navbar/Home
8) ربط Inbox بنموذج contact
9) تثبيت xlsx + jspdf + jspdf-autotable + recharts (موجود؟)
10) اختبار build + smoke test لكل قسم
```

## ملاحظات مهمة

- الحجم ضخم جدًا (≈20 جدول جديد + ≈15 قسم UI). سأنفذ على دفعتين داخل نفس المحادثة:
  - **دفعة A**: Migration + queries + الأقسام الحرجة (Promotions, Expenses, Reports, Policies, CRM, Content, Inbox, Banners).
  - **دفعة B**: Subscriptions, Loyalty, Notification Templates, Permissions, Security Log, Payment Methods, Waitlist, POS, Backup Export, Global Search.
- بعض الأنظمة (SMS/Email فعلي، 2FA، Force Logout بشكل حقيقي) تحتاج تكاملات خارجية. سأنفّذ الواجهات كاملة + سجل داخلي + hooks جاهزة، وأشير في التقرير النهائي لما يحتاج مزوّد خارجي لتفعيله فعليًا.

هل أبدأ التنفيذ؟