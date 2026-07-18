import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-gold-gradient">٤٠٤</h1>
        <h2 className="mt-4 text-xl font-bold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير متاحة أو تم نقلها.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-bold text-gold-foreground shadow-gold transition hover:brightness-110"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          نعتذر عن ذلك، يمكنك المحاولة مرة أخرى أو العودة للرئيسية.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-bold text-gold-foreground shadow-gold"
          >
            حاول مجدداً
          </button>
          <a href="/" className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent">
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "صالون هارون — HAROUN | حلاقة رجالية فاخرة في القاهرة" },
      { name: "description", content: "احجز موعدك في صالون هارون. تجربة حلاقة راقية بأيدي محترفين — قص، تهذيب لحية، حلاقة ملكية، وباقات العرسان." },
      { name: "author", content: "Haroun Salon" },
      { name: "theme-color", content: "#1a1510" },
      { property: "og:title", content: "صالون هارون — HAROUN | حلاقة رجالية فاخرة في القاهرة" },
      { property: "og:description", content: "احجز موعدك في صالون هارون. تجربة حلاقة راقية بأيدي محترفين — قص، تهذيب لحية، حلاقة ملكية، وباقات العرسان." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ar_EG" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "صالون هارون — HAROUN | حلاقة رجالية فاخرة في القاهرة" },
      { name: "twitter:description", content: "احجز موعدك في صالون هارون. تجربة حلاقة راقية بأيدي محترفين — قص، تهذيب لحية، حلاقة ملكية، وباقات العرسان." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eda1c94e-7ed8-4504-85a9-7aca06cff2e7/id-preview-8032763f--e979a75d-46c5-4027-9938-5817ed44004e.lovable.app-1784354100418.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/eda1c94e-7ed8-4504-85a9-7aca06cff2e7/id-preview-8032763f--e979a75d-46c5-4027-9938-5817ed44004e.lovable.app-1784354100418.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" dir="rtl" theme="dark" richColors closeButton />
    </QueryClientProvider>
  );
}
