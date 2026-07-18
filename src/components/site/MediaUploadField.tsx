import { useRef, useState } from "react";
import { Upload, Loader2, X, Image as ImageIcon, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const MAX_IMAGE_MB = 5;
const MAX_VIDEO_MB = 50;

export type UploadedMedia = { url: string; type: "image" | "video" };

/** Uploads an image OR short video to the media bucket and returns a signed URL. */
export function MediaUploadField({
  onUploaded,
  accept = "image/*,video/*",
  label = "ارفع صورة أو فيديو قصير",
  aspect = "aspect-square",
}: {
  onUploaded: (m: UploadedMedia) => void | Promise<void>;
  accept?: string;
  label?: string;
  aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  async function upload(file: File) {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) { toast.error("الملف يجب أن يكون صورة أو فيديو"); return; }
    const maxMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`حجم الملف أكبر من ${maxMB} ميجا`);
      return;
    }

    setUploading(true);
    setProgress(isVideo ? 5 : null);
    // Fake steady progress for videos (Supabase SDK v2 lacks a native progress hook here).
    let fakeTimer: any = null;
    if (isVideo) {
      fakeTimer = setInterval(() => setProgress((p) => (p !== null && p < 90 ? p + 3 : p)), 400);
    }
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const path = `portfolio/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data, error } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
      if (error) throw error;
      setProgress(100);
      await onUploaded({ url: data.signedUrl, type: isVideo ? "video" : "image" });
      toast.success("تم الرفع بنجاح");
    } catch (e: any) {
      toast.error("تعذّر الرفع: " + (e?.message ?? "خطأ"));
    } finally {
      if (fakeTimer) clearInterval(fakeTimer);
      setUploading(false);
      setTimeout(() => setProgress(null), 600);
    }
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
            <span className="text-sm font-bold">جارٍ الرفع...</span>
            {progress !== null && (
              <div className="w-3/4 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gold-gradient transition-all duration-300" style={{ width: `${progress}%` }} />
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
            <span className="text-[11px] text-muted-foreground">صور حتى {MAX_IMAGE_MB}MB — فيديو حتى {MAX_VIDEO_MB}MB</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
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
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, {
        cacheControl: "31536000", contentType: file.type, upsert: false,
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
