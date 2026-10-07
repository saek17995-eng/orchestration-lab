import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "三维智能管弦乐配器教学系统",
  description: "以三维舞台、同步总谱与可解释分析辅助管弦乐配器学习。",
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
