import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isFirecrawlConfigured } from "@/lib/scraper";
import { isOpenAIConfigured } from "@/lib/ai";

export async function GET() {
  return NextResponse.json({
    supabase: isSupabaseConfigured,
    firecrawl: isFirecrawlConfigured,
    openai: isOpenAIConfigured,
    mode: isSupabaseConfigured ? "cloud_production" : "interactive_demo",
  });
}
