import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CallAgent from "@/components/CallAgent";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Nexora — Quality Products for a Modern You",
    template: "%s · Nexora",
  },
  description:
    "Discover everyday essentials, trendy picks, and must-haves — all in one place.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <Header />
        <main id="top" className="flex-1">
          {children}
        </main>
        <Footer />
        <CallAgent />
      </body>
    </html>
  );
}
