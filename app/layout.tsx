import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "华音｜民族音色与智能配器实验室",
  description: "融合民族乐器音色认知与三维智能配器训练的一站式音乐课堂工具。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
