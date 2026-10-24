import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zenex Sports Custom — Kit Creator",
  description:
    "Design football kits in 3D, customise colours, patterns and logos, then export texture-ready kit files.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
