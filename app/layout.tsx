import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});
export const metadata: Metadata = {
  title: "مركز ذكاء السوق | نجم",
  description:
    "مركز متابعة الأخبار التنظيمية وقطاع التأمين السعودي للخزينة والاستثمار، بمصادر معلنة وملخص تنفيذي مسند.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#153a29",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`bg-background ${arabic.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
