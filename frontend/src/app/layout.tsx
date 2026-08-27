import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://photopol.us"),
  title: {
    default: "Photopol — One AI Workspace for Every Image",
    template: "%s | Photopol",
  },
  description:
    "Create. Edit. Enhance. Resize. Export. Photopol brings your entire image workflow into one AI workspace.",
  openGraph: {
    title: "Photopol — One AI Workspace for Every Image",
    description:
      "Stop jumping between AI tools. Upload once. Do everything in one workspace.",
    url: "https://photopol.us",
    siteName: "Photopol",
    type: "website",
  },
  alternates: {
    canonical: "https://photopol.us",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${display.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
