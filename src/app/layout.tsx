import type { Metadata } from "next";
import "./globals.css";
import ConditionalLayout from "@/components/ConditionalLayout";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "SiPERPUS - Sistem Perpustakaan SMA",
  description: "Sistem Manajemen Perpustakaan Sekolah Menengah Atas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
