import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pasti Premium.id - Premium Account Platform",
  description: "Premium account inventory and auto delivery platform by Pasti Premium.id",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
