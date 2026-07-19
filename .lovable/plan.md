
# خطة التنفيذ المرحلية

الطلب ضخم جداً (10+ أنظمة). هنشتغل على مراحل، كل مرحلة كاملة ومستقرة قبل الانتقال للي بعدها. ده يوفر رصيد ويخلي التستينج ممكن.

---

## المرحلة 1 (الأولوية اللي اختارتها) — نظام الإشعارات + بنية الفروع

### 1.أ) بنية الفروع (Multi-branch foundation)
ضروري نعملها الأول لأن كل الإشعارات والطلبات لازم تعرف الفرع.

- جدول `branches` جديد: name, address, phone, working_hours, telegram_chat_id, whatsapp_number, is_active
- إضافة `branch_id` على: `barbers`, `bookings`, (والمنتجات لاحقاً في مرحلة 2)
- Migration seed: فرعين افتراضيين (تكتب أسماءهم بعد الموافقة)، والصنايعية الحاليين يترحلوا للفرع الأول
- في **admin.tsx**: قسم جديد "الفروع" (CRUD) + في محرر الصنايعي/الحجز dropdown اختيار الفرع
- كل فرع له `telegram_chat_id` و `whatsapp_admin_number` منفصلين، فالإشعارات تروح للفرع المعني

### 1.ب) بوت Telegram (باستخدام Telegram connector الجاهز)
- خطوة أولى: تعمل `standard_connectors--connect` لـ Telegram + تدخل bot token من BotFather
- خطوة تانية: لكل فرع تبعت `/start` للبوت من حساب الأدمن، وتضيف `chat_id` في إعدادات الفرع من لوحة الأدمن
- Server function `sendTelegramNotification(branchId, message)` تبعت للـ chat_id بتاع الفرع
- Triggers (server functions تتنادى من الـ mutation):
  - حجز جديد → رسالة فيها: اسم الصنايعي، الخدمات، الموعد، السعر، اسم/تليفون العميل، **رابط معاينة** `/admin?booking=<id>`
  - طلب منتج جديد (مرحلة 2 لما نبنيه)
  - نقص مخزون (مرحلة 2)
  - صنايعي علّم `is_present=false` → إشعار

### 1.ج) WhatsApp Cloud API (Meta)
- محتاجين منك 3 حاجات (سيكريتس):
  1. `WHATSAPP_PHONE_NUMBER_ID` (من Meta Business)
  2. `WHATSAPP_ACCESS_TOKEN` (permanent token)
  3. `WHATSAPP_BUSINESS_ACCOUNT_ID`
- بعدين نعمل template مُعتمد من Meta اسمه مثلاً `new_booking_alert` بمتغيرات (اسم، صنايعي، وقت، رابط)
- Server function `sendWhatsAppTemplate(to, template, params)` تبعت لرقم كل فرع
- ملاحظة: templates لازم Meta توافق عليها (تاخد يوم أو اتنين). قبل الموافقة يمكن نبعت رسائل عادية لأول 24 ساعة بعد ما يبعتلك العميل رسالة، لكن للـ proactive alerts template إجباري.

### 1.د) Center الإشعارات في الأدمن
- Panel جديدة في `/admin`: سجل الإشعارات (من `notifications_log` الموجود أصلاً) — status (sent/failed/pending)، channel، retry button
- Toggle لكل نوع إشعار (تشغيل/إيقاف telegram أو whatsapp له)

---

## المرحلات القادمة (بعد الموافقة على 1)

- **مرحلة 2:** المتجر (منتجات + صور متعددة + فئات + أقسام + سلة + شيك آوت مع تسجيل دخول + QR منيو + تتبع مخزون تلقائي)
- **مرحلة 3:** كاشير POS + فواتير + طابعة Bluetooth (Web Bluetooth API — Chrome/Android فقط) + Offline mode (IndexedDB + background sync)
- **مرحلة 4:** نظام البونص/الرصيد (نقاط تتحوّل رصيد يستخدمه في الحجز أو الشراء) + Audit trail موسع (كل إجراء كاشير)
- **مرحلة 5:** QR للصنايعي + QR للمنتجات + تحسينات نهائية

---

## مطلوب منك قبل ما أبدأ المرحلة 1

1. **أسماء الفرعين** (اسم كامل + عنوان + تليفون لكل فرع)
2. **Telegram bot**: تدخل على @BotFather في تيليجرام → `/newbot` → تختار اسم → يديك token → تبعتهولي أو تضيفه لما أطلب الـ connector
3. **WhatsApp Meta credentials**: لو مش جاهزين، أقدر أبني المرحلة والإشعارات تفعّل Telegram الأول، وWhatsApp نضيفه لما تجيب الـ credentials

بعد ما توافق على الخطة وتبعت اسم الفرعين، أبدأ فوراً بالـ migration ثم الـ connector ثم الـ server functions.
