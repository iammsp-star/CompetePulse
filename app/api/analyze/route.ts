import { NextResponse } from "next/server";
import {
  getLatestSnapshot,
  saveSnapshot,
  saveInsight,
  updateTargetStatus,
} from "@/lib/supabase";
import { scrapeTargetUrl } from "@/lib/scraper";
import { analyzeCompetitorDiff } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetId, competitorId, url, competitorName } = body;

    if (!url || !targetId || !competitorId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: url, targetId, or competitorId" },
        { status: 400 }
      );
    }

    const compName = competitorName || "Competitor";

    // 1. Fetch previous snapshot for SHA-256 comparison
    const previousSnapshot = await getLatestSnapshot(targetId);

    // 2. Run Firecrawl scraper & SHA-256 hash calculation
    const scrapeResult = await scrapeTargetUrl(url, previousSnapshot);

    // 3. Delta Check: If content matches previous hash, skip AI analysis
    if (!scrapeResult.hasChanged && previousSnapshot) {
      await updateTargetStatus(targetId, "active");
      return NextResponse.json({
        success: true,
        hasChanged: false,
        message: "No changes detected. SHA-256 hash matches previous snapshot.",
        hash: scrapeResult.hash,
        lastScrapedAt: new Date().toISOString(),
      });
    }

    // 4. Content has changed (or first snapshot) -> Run OpenAI GPT-4o Analysis
    const aiInsight = await analyzeCompetitorDiff({
      competitorName: compName,
      url,
      oldContent: previousSnapshot?.content_markdown,
      newContent: scrapeResult.markdown,
      diff: scrapeResult.diff,
    });

    // 5. Store new Snapshot in Supabase
    const savedSnapshot = await saveSnapshot({
      target_id: targetId,
      content_markdown: scrapeResult.markdown,
      content_hash: scrapeResult.hash,
      http_status: 200,
      metadata: {
        source: scrapeResult.source,
        previous_hash: previousSnapshot?.content_hash || null,
      },
    });

    // 6. Store new AI Insight in Supabase
    const savedInsight = await saveInsight({
      target_id: targetId,
      competitor_id: competitorId,
      category: aiInsight.category,
      impact_level: aiInsight.impact_level,
      summary: aiInsight.summary,
      key_takeaways: aiInsight.key_takeaways,
      suggested_counter_action: aiInsight.suggested_counter_action,
      diff_content: scrapeResult.diff || "Initial capture of monitored content.",
      old_hash: previousSnapshot?.content_hash,
      new_hash: scrapeResult.hash,
    });

    // 7. Update monitored target status
    await updateTargetStatus(targetId, "changed");

    return NextResponse.json({
      success: true,
      hasChanged: true,
      message: "Change detected! AI analysis completed successfully.",
      insight: savedInsight,
      snapshotId: savedSnapshot.id,
      hash: scrapeResult.hash,
      source: scrapeResult.source,
    });
  } catch (error: any) {
    console.error("POST /api/analyze error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to analyze target" },
      { status: 500 }
    );
  }
}
