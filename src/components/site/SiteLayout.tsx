import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { SiteBanner } from "./SiteBanner";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] bg-hero" />
      <Navbar />
      <SiteBanner />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

