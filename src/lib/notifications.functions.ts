import { createServerFn } from "@tanstack/react-start";

// ============================================================================
// Notification server functions — Telegram (via connector gateway) + WhatsApp
// Cloud API (Meta). Fire-and-forget from client after booking/order creation.
// ============================================================================

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";
const WA_API_BASE = "https://graph.facebook.com/v20.0";

type Payload = { bookingId: string };

/** Send a plain Telegram message to a specific chat_id via the connector gateway. */
async function sendTelegram(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const LOVABLE = process.env.LOVABLE_API_KEY;
  const TG = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE || !TG) return { ok: false, error: "Telegram connector not configured" };
  try {
    const r = await fetch(`${TG_GATEWAY}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE}`,
        "X-Connection-Api-Key": TG,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: false }),
    });
    if (!r.ok) return { ok: false, error: `Telegram ${r.status}: ${await r.text()}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/** Send a WhatsApp template message via Meta Cloud API. */
async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, error: "WhatsApp not configured" };
  try {
    const r = await fetch(`${WA_API_BASE}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^\d]/g, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: bodyParams.length
            ? [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: t })) }]
            : [],
        },
      }),
    });
    if (!r.ok) return { ok: false, error: `WhatsApp ${r.status}: ${await r.text()}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

function formatBookingMessage(b: any, servicesText: string, adminUrl: string) {
  const barberName = b.barbers?.name ?? "أي حلاق";
  const branchName = b.branches?.name ?? "—";
  return [
    `🔔 <b>حجز جديد</b>`,
    `━━━━━━━━━━━━━`,
    `🏢 الفرع: <b>${branchName}</b>`,
    `👤 العميل: <b>${b.customer_name ?? "—"}</b>`,
    `📞 الهاتف: <code>${b.customer_phone ?? "—"}</code>`,
    `✂️ الحلاق: ${barberName}`,
    `💈 الخدمات: ${servicesText}`,
    `📅 الموعد: <b>${b.booking_date} ${b.booking_time}</b>`,
    `💰 الإجمالي: <b>${b.price_egp ?? 0} ج.م</b>`,
    `📝 الحالة: ${b.status === "pending_payment" ? "⏳ بانتظار الدفع" : "🆕 جديد"}`,
    ``,
    `🔗 <a href="${adminUrl}">فتح في لوحة الأدمن</a>`,
  ].join("\n");
}

/** Public server fn: called after a booking insert; sends notifications to the branch admins. */
export const notifyBookingCreated = createServerFn({ method: "POST" })
  .inputValidator((d: Payload) => {
    if (!d?.bookingId || typeof d.bookingId !== "string") throw new Error("bookingId required");
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotency: skip if already notified for this booking
    const { data: existing } = await supabaseAdmin
      .from("notifications_log")
      .select("id")
      .eq("event_type", "new_booking")
      .contains("payload", { booking_id: data.bookingId })
      .limit(1);
    if (existing && existing.length > 0) return { ok: true, skipped: true };

    // Load global toggles
    const { data: settingRow } = await supabaseAdmin
      .from("site_settings").select("value").eq("key", "notification_channels").maybeSingle();
    const settings: any = settingRow?.value ?? {};
    const globalTelegram = settings.telegram_enabled !== false;
    const globalWhatsapp = settings.whatsapp_enabled === true;
    const eventEnabled = settings?.events?.new_booking !== false;
    if (!eventEnabled) return { ok: true, skipped: true };

    // Load booking with joins
    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .select("id, customer_name, customer_phone, booking_date, booking_time, price_egp, status, branch_id, barbers(name), branches(id, name, telegram_chat_id, whatsapp_number, notification_prefs)")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (bErr || !booking) return { ok: false, error: bErr?.message ?? "Booking not found" };

    // Load booking_services
    const { data: bs } = await supabaseAdmin
      .from("booking_services").select("services(name)").eq("booking_id", data.bookingId);
    const servicesText = (bs ?? []).map((r: any) => r.services?.name).filter(Boolean).join("، ") || "—";

    // Determine site URL for admin link
    const siteUrl = process.env.SITE_URL || "https://haron-salon.lovable.app";
    const adminUrl = `${siteUrl}/admin?booking=${data.bookingId}`;

    const branch: any = booking.branches;
    const branchPrefs = branch?.notification_prefs ?? {};
    const message = formatBookingMessage(booking, servicesText, adminUrl);

    const results: Array<{ channel: string; ok: boolean; error?: string }> = [];

    // --- Telegram ---
    if (globalTelegram && branchPrefs.telegram !== false && branch?.telegram_chat_id) {
      const r = await sendTelegram(branch.telegram_chat_id, message);
      results.push({ channel: "telegram", ...r });
      await supabaseAdmin.from("notifications_log").insert({
        template_key: "new_booking",
        channel: "telegram",
        recipient: branch.telegram_chat_id,
        body: message,
        status: r.ok ? "sent" : "failed",
        error: r.error ?? null,
        branch_id: branch.id,
        event_type: "new_booking",
        payload: { booking_id: data.bookingId },
      });
    }

    // --- WhatsApp (template) ---
    if (globalWhatsapp && branchPrefs.whatsapp === true && branch?.whatsapp_number) {
      const templateName = process.env.WHATSAPP_TEMPLATE_NEW_BOOKING || "new_booking_alert";
      const langCode = process.env.WHATSAPP_TEMPLATE_LANG || "ar";
      const params = [
        booking.customer_name ?? "—",
        booking.customer_phone ?? "—",
        servicesText,
        `${booking.booking_date} ${booking.booking_time}`,
        `${booking.price_egp ?? 0} EGP`,
      ];
      const r = await sendWhatsAppTemplate(branch.whatsapp_number, templateName, langCode, params);
      results.push({ channel: "whatsapp", ...r });
      await supabaseAdmin.from("notifications_log").insert({
        template_key: templateName,
        channel: "whatsapp",
        recipient: branch.whatsapp_number,
        body: message,
        status: r.ok ? "sent" : "failed",
        error: r.error ?? null,
        branch_id: branch.id,
        event_type: "new_booking",
        payload: { booking_id: data.bookingId, template: templateName },
      });
    }

    return { ok: true, results };
  });

/** Resend a notification for a booking (admin action). */
export const resendBookingNotification = createServerFn({ method: "POST" })
  .inputValidator((d: Payload) => {
    if (!d?.bookingId) throw new Error("bookingId required");
    return d;
  })
  .handler(async ({ data }) => {
    // Delete previous log row so idempotency check passes
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notifications_log")
      .delete()
      .eq("event_type", "new_booking")
      .contains("payload", { booking_id: data.bookingId });
    // Re-invoke by calling logic inline (server-to-server call is fine)
    return notifyBookingCreated({ data: { bookingId: data.bookingId } });
  });

/** Test telegram: send a hello message to a given chat_id (admin only, via UI). */
export const sendTelegramTest = createServerFn({ method: "POST" })
  .inputValidator((d: { chatId: string; text?: string }) => {
    if (!d?.chatId) throw new Error("chatId required");
    return d;
  })
  .handler(async ({ data }) => {
    const r = await sendTelegram(data.chatId, data.text || "✅ اختبار اتصال — بوت الإشعارات شغّال.");
    return r;
  });
