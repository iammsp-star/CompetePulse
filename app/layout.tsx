import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CompetePulse — AI Competitor Research & Intelligence",
  description: "Monitor competitor pricing, features, and messaging changes with Firecrawl, SHA-256 delta detection, and OpenAI GPT-4o.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
