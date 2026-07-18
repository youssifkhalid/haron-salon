import { Instagram, Facebook } from "lucide-react";
import { whatsappHref, socialHref } from "@/lib/queries-barber";

/** WhatsApp SVG icon (lucide has no WhatsApp icon). */
export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 0 0 5.71 1.447h.005c6.585 0 11.946-5.336 11.949-11.896 0-3.181-1.24-6.174-3.479-8.45zM12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.977 1.005-3.633-.235-.375a9.86 9.86 0 0 1-1.51-5.27c.002-5.45 4.455-9.884 9.929-9.884 2.65 0 5.145 1.03 7.021 2.9 1.875 1.87 2.909 4.352 2.908 6.99-.003 5.45-4.455 9.887-9.981 9.887z" fillRule="evenodd" />
    </svg>
  );
}

/** TikTok SVG icon (lucide has no TikTok icon). */
export function TikTokIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.83a8.16 8.16 0 0 0 4.77 1.52V6.89a4.85 4.85 0 0 1-1.84-.2z" />
    </svg>
  );
}

export function SocialLinks({
  whatsapp, instagram, tiktok, facebook, size = "md",
}: {
  whatsapp: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const items = [
    { href: whatsappHref(whatsapp), icon: <WhatsAppIcon />, label: "واتساب", color: "hover:bg-[oklch(0.62_0.16_150)]/20 hover:text-[oklch(0.72_0.16_150)]" },
    { href: socialHref("instagram", instagram), icon: <Instagram className="h-5 w-5" />, label: "انستجرام", color: "hover:bg-[oklch(0.6_0.2_10)]/20 hover:text-[oklch(0.7_0.2_10)]" },
    { href: socialHref("tiktok", tiktok), icon: <TikTokIcon />, label: "تيك توك", color: "hover:bg-foreground/10" },
    { href: socialHref("facebook", facebook), icon: <Facebook className="h-5 w-5" />, label: "فيسبوك", color: "hover:bg-[oklch(0.5_0.15_260)]/20 hover:text-[oklch(0.7_0.15_260)]" },
  ].filter((i) => i.href);
  if (items.length === 0) return null;
  const sizeCls = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <a
          key={i.label}
          href={i.href!}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={i.label}
          className={`inline-flex ${sizeCls} items-center justify-center rounded-full border border-gold/20 bg-surface-elevated text-foreground/80 transition ${i.color}`}
        >
          {i.icon}
        </a>
      ))}
    </div>
  );
}
