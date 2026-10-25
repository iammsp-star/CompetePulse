import { NextResponse } from "next/server";
import { fetchCompetitorsWithTargets, addCompetitor } from "@/lib/supabase";

export async function GET() {
  try {
    const competitors = await fetchCompetitorsWithTargets();
    return NextResponse.json({ success: true, data: competitors });
  } catch (error: any) {
    console.error("GET /api/competitors error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch competitors" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, url, category, target_type } = body;

    if (!name || !url) {
      return NextResponse.json(
        { success: false, error: "Competitor Name and Target URL are required" },
        { status: 400 }
      );
    }

    // Ensure URL has protocol
    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const result = await addCompetitor({
      name: name.trim(),
      url: formattedUrl,
      category: category || "SaaS",
      target_type: target_type || "pricing",
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/competitors error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create competitor" },
      { status: 500 }
    );
  }
}
