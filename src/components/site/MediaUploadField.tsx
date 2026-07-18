import { useRef, useState } from "react";
import { Upload, Loader2, X, Image as ImageIcon, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const MAX_IMAGE_MB = 100;
const MAX_VIDEO_MB = 500;

// Ultra-fast client-side compression — tuned for near-instant portfolio uploads.
async function fastCompress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  // Skip tiny images entirely.
  if (file.size < 350 * 1024) return file;
  try {
    const out = await imageCompression(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      initialQuality: 0.72,
      fileType: file.type === "image/png" ? "image/png" : "image/jpeg",
    });
    return out.size < file.size ? (out as File) : file;
  } catch { return file; }
}


export type UploadedMedia = { url: string; type: "image" | "video"; thumbnail_url?: string | null };

async function uploadOne(file: File): Promise<UploadedMedia> {
  const isVideo = file.type.startsWith("video/");
  const maxMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
  if (file.size > maxMB * 1024 * 1024) throw new Error(`حجم "${file.name}" أكبر من ${maxMB} ميجا`);
  const toUpload = isVideo ? file : await fastCompress(file);
  const ext = isVideo ? (file.name.split(".").pop()?.toLowerCase() || "mp4") : (toUpload.type === "image/png" ? "png" : "jpg");
  const path = `portfolio/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("media").upload(path, toUpload, {
    cacheControl: "31536000", contentType: toUpload.type, upsert: false,
  });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
  if (error) throw error;
  return { url: data.signedUrl, type: isVideo ? "video" : "image" };
}

/** Uploads image(s) OR a short video and returns signed URLs. Supports batch + optimistic previews. */
export function MediaUploadField({
  onUploaded,
  accept = "image/*,video/*",
  label = "ارفع صور أو فيديو قصير",
  aspect = "aspect-square",
  multiple = true,
}: {
  onUploaded: (m: UploadedMedia) => void | Promise<void>;
  accept?: string;
  label?: string;
  aspect?: string;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function uploadMany(files: File[]) {
    const hasVideo = files.some((f) => f.type.startsWith("video/"));
    const hasImage = files.some((f) => f.type.startsWith("image/"));
    if (hasVideo && hasImage) { toast.error("لا يمكن دمج فيديو مع صور في نفس البوست"); return; }
    if (hasVideo && files.length > 1) { toast.error("ارفع فيديو واحد فقط في المرة"); return; }

    setUploading(true);
    setProgress({ done: 0, total: files.length });
    let success = 0, fail = 0;
    // Fully-parallel uploads — Supabase storage handles concurrency well; the browser
    // and server are the bottleneck, not us. For very large batches (>12) chunk to avoid
    // opening too many sockets simultaneously.
    const chunk = files.length > 12 ? 8 : files.length;
    for (let i = 0; i < files.length; i += chunk) {
      const slice = files.slice(i, i + chunk);
      const results = await Promise.allSettled(slice.map(uploadOne));
      for (const r of results) {
        if (r.status === "fulfilled") { await onUploaded(r.value); success++; }
        else { fail++; toast.error(r.reason?.message ?? "فشل رفع ملف"); }
        setProgress((p) => p ? { ...p, done: p.done + 1 } : p);
      }
    }
    setUploading(false);
    setTimeout(() => setProgress(null), 500);
    if (success > 0) toast.success(`تم رفع ${success} ملف${fail ? ` — فشل ${fail}` : ""}`);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`flex ${aspect} w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border hover:border-gold hover:bg-gold/5 transition disabled:opacity-70`}
      >
        {uploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
            <span className="text-sm font-bold">
              {progress ? `جارٍ الرفع ${progress.done}/${progress.total}` : "جارٍ الرفع..."}
            </span>
            {progress && (
              <div className="w-3/4 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gold-gradient transition-all duration-300"
                  style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-gold">
              <ImageIcon className="h-5 w-5" />
              <span className="text-xs">أو</span>
              <Video className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <Upload className="h-4 w-4 text-gold" />
              <span className="text-sm font-bold">{label}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {multiple ? "يمكنك اختيار عدة صور دفعة واحدة" : "ملف واحد"} — صور حتى {MAX_IMAGE_MB}MB / فيديو حتى {MAX_VIDEO_MB}MB
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) uploadMany(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Simple single-file uploader (image OR video) returning URL; used for profile/cover images. */
export function SingleImageUpload({
  value, onChange, aspect = "aspect-video", label = "ارفع صورة",
}: {
  value: string;
  onChange: (url: string) => void;
  aspect?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("الملف يجب أن يكون صورة"); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { toast.error(`حجم الصورة أكبر من ${MAX_IMAGE_MB} ميجا`); return; }
    setUploading(true);
    try {
      const compressed = await fastCompress(file);
      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, compressed, {
        cacheControl: "31536000", contentType: compressed.type, upsert: false,
      });

      if (upErr) throw upErr;
      const { data, error } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
      if (error) throw error;
      onChange(data.signedUrl);
      toast.success("تم رفع الصورة");
    } catch (e: any) {
      toast.error("تعذّر الرفع: " + (e?.message ?? "خطأ"));
    } finally { setUploading(false); }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className={`relative group rounded-2xl overflow-hidden border border-border ${aspect}`}>
          <img src={value} alt="" className="h-full w-full object-cover" />
          <button type="button" onClick={() => onChange("")}
            className="absolute top-2 left-2 rounded-full bg-destructive/90 p-1.5 text-destructive-foreground opacity-0 group-hover:opacity-100 transition">
            <X className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="absolute bottom-2 left-2 rounded-lg bg-background/80 px-2.5 py-1 text-xs font-bold text-gold backdrop-blur hover:bg-background inline-flex items-center gap-1">
            <Upload className="h-3 w-3" /> {uploading ? "جارٍ..." : "استبدال"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className={`flex ${aspect} w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border hover:border-gold hover:bg-gold/5 transition`}>
          {uploading
            ? <><Loader2 className="h-5 w-5 animate-spin text-gold" /> <span className="text-sm font-bold">جارٍ الرفع...</span></>
            : <><Upload className="h-5 w-5 text-gold" /> <span className="text-sm font-bold">{label}</span></>}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </div>
  );
}
