import type { Metadata } from "next";
import { Share_Tech_Mono, Tajawal } from "next/font/google";
import { APP_NAME } from "@custom-os-ota/shared";
import "./globals.css";

const mono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
  display: "swap",
});

const sans = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "OTA update management for CUSTOM_OS_NAME",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${mono.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
