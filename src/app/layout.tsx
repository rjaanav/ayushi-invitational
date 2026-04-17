import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/hooks/useAuth";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: "The Ayushi Invitational",
  description:
    "A one-night-only Americano padel tournament for the birthday girl.",
  openGraph: {
    title: "The Ayushi Invitational",
    description: "Padel. Memories. A midnight birthday to remember.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b3d4e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <div className="mx-auto w-full max-w-[480px] flex-1 flex flex-col relative">
            {children}
          </div>
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              style: {
                borderRadius: "16px",
                fontFamily: "var(--font-sans)",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
