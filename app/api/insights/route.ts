import { NextResponse } from "next/server";
import { fetchInsights } from "@/lib/supabase";

export async function GET() {
  try {
    const insights = await fetchInsights();
    return NextResponse.json({ success: true, data: insights });
  } catch (error: any) {
    console.error("GET /api/insights error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
