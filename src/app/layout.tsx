import type { Metadata } from "next";
import { IBM_Plex_Mono, Libre_Franklin, Zilla_Slab } from "next/font/google";
import "./globals.css";

const franklin = Libre_Franklin({
  variable: "--font-franklin",
  subsets: ["latin"],
});

const zilla = Zilla_Slab({
  variable: "--font-zilla",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Label Check — TTB Label Verification",
  description:
    "AI-assisted verification of alcohol beverage labels against COLA application data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${franklin.variable} ${zilla.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
