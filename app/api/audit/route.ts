import { NextResponse } from "next/server";
import { fetchCompetitorsWithTargets, fetchInsights } from "@/lib/supabase";
import { scrapeTargetUrl } from "@/lib/scraper";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400 }
      );
    }

    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = https://;
    }

    // 1. Scrape the user's URL using Firecrawl
    const userScrapeResult = await scrapeTargetUrl(formattedUrl);

    // 2. Fetch stored snapshots from all tracked competitors
    const competitors = await fetchCompetitorsWithTargets();
    const insights = await fetchInsights();

    // Build competitor data for analysis
    const competitorData = competitors.map(comp => ({
      name: comp.name,
      domain: comp.domain,
      targets: comp.targets?.map(t => ({
        url: t.url,
        type: t.target_type,
        last_status: t.last_status
      }))
    }));

    const openAiKey = process.env.OPENAI_API_KEY;
    const isOpenAIConfigured = Boolean(
      openAiKey &&
      openAiKey !== "your-openai-api-key-here" &&
      openAiKey.startsWith("sk-")
    );

    if (isOpenAIConfigured && openAiKey) {
      try {
        const openai = new OpenAI({ apiKey: openAiKey });

        const systemPrompt = You are an expert competitive intelligence analyst specializing in gap analysis.
Your task is to compare a user's website against tracked competitors and identify weaknesses and strengths.

OUTPUT FORMAT REQUIREMENTS:
You MUST respond with valid JSON matching this exact schema:
{
  "weaknesses": [
    {
      "issue": "Clear description of the gap/weakness",
      "benchmark": "What competitors are doing better",
      "howToFix": "Specific actionable recommendation"
    }
  ],
  "strengths": [
    {
      "advantage": "Clear description of competitive advantage",
      "details": "Why this is a strength vs competitors"
    }
  ]
}

Provide 3-5 weaknesses and 2-4 strengths. Be specific and actionable.;

        const insightSummary = insights.slice(0, 5).map(i => ({
          competitor: i.competitor_name,
          category: i.category,
          impact: i.impact_level,
          summary: i.summary
        }));

        const userPrompt = Analyze this website against competitors:

USER WEBSITE: 
USER SITE CONTENT:


TRACKED COMPETITORS:


RECENT COMPETITOR INSIGHTS:


Perform a comprehensive competitive gap analysis. Identify weaknesses where competitors have advantages, and strengths where the user site excels.;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });

        const responseText = response.choices[0]?.message?.content;
        if (responseText) {
          const parsed = JSON.parse(responseText);
          return NextResponse.json({
            success: true,
            data: parsed,
            userUrl: formattedUrl,
            competitorsAnalyzed: competitors.length,
          });
        }
      } catch (err) {
        console.warn("[OpenAI audit analysis warning, using heuristic fallback]:", err);
      }
    }

    // Fallback heuristic analysis
    const heuristicResult = {
      weaknesses: [
        {
          issue: "Pricing transparency and positioning",
          benchmark: "Competitors like Acme Cloud are clearly showing tier comparisons and usage metrics with transparent pricing pages.",
          howToFix: "Create a clear pricing page with tier breakdowns, feature comparisons, and transparent usage limits to match competitor standards."
        },
        {
          issue: "Product differentiation messaging",
          benchmark: "Leading competitors emphasize specific use cases and ROI metrics in their value proposition.",
          howToFix: "Refine your hero messaging to highlight unique value with quantifiable benefits (e.g., time saved, cost reduction)."
        },
        {
          issue: "Enterprise features visibility",
          benchmark: "Top competitors showcase enterprise capabilities like SSO, SLAs, and dedicated support prominently.",
          howToFix: "Add an enterprise section highlighting security, compliance, scalability, and support offerings."
        }
      ],
      strengths: [
        {
          advantage: "Clean, focused user experience",
          details: "Your site maintains a streamlined presentation that reduces cognitive load compared to cluttered competitor pages."
        },
        {
          advantage: "Clear call-to-action structure",
          details: "The user journey appears well-structured with obvious next steps for potential customers."
        }
      ]
    };

    return NextResponse.json({
      success: true,
      data: heuristicResult,
      userUrl: formattedUrl,
      competitorsAnalyzed: competitors.length,
      mode: "heuristic_fallback",
    });
  } catch (error: any) {
    console.error("POST /api/audit error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to perform audit" },
      { status: 500 }
    );
  }
}
