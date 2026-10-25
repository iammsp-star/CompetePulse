import OpenAI from "openai";

export interface AIAnalysisResult {
  category: "pricing_change" | "feature_launch" | "messaging_shift" | "other";
  impact_level: "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  key_takeaways: string[];
  suggested_counter_action: string;
}

const openAiKey = process.env.OPENAI_API_KEY;
export const isOpenAIConfigured = Boolean(
  openAiKey &&
  openAiKey !== "your-openai-api-key-here" &&
  openAiKey.startsWith("sk-")
);

/**
 * Intelligent local analysis generator when OpenAI API key is not yet set
 * or when in offline demo mode.
 */
function generateHeuristicAnalysis(params: {
  competitorName: string;
  url: string;
  newContent: string;
  diff?: string;
}): AIAnalysisResult {
  const content = (params.diff || params.newContent).toLowerCase();

  if (content.includes("price") || content.includes("$") || content.includes("/mo") || content.includes("tier")) {
    return {
      category: "pricing_change",
      impact_level: "HIGH",
      summary: `${params.competitorName} has adjusted their pricing structure and subscription tiers on ${params.url}. Key changes involve revised tier limits, new usage overage metrics, or price increases.`,
      key_takeaways: [
        "Core plan pricing altered or unbundled into usage-based metrics.",
        "Free trial or entry starter tier terms updated.",
        "Increased focus on enterprise billing and annual contract commitments.",
      ],
      suggested_counter_action: `Deploy a targeted competitive comparison highlighting our transparent pricing, lower total cost of ownership, and zero-penalty usage policies.`,
    };
  }

  if (content.includes("feature") || content.includes("ai") || content.includes("v4") || content.includes("release") || content.includes("integration")) {
    return {
      category: "feature_launch",
      impact_level: "MEDIUM",
      summary: `${params.competitorName} announced new functional capabilities and integration features on ${params.url}, expanding their workflow automation footprint.`,
      key_takeaways: [
        "Added new workflow automation and developer tool integrations.",
        "Strengthened enterprise security compliance and admin visibility.",
        "Elevated AI-assisted features directly into mid-tier plans.",
      ],
      suggested_counter_action: `Review our upcoming product sprint to accelerate competing feature releases and prepare a battlecard for sales addressing this new release.`,
    };
  }

  return {
    category: "messaging_shift",
    impact_level: "LOW",
    summary: `${params.competitorName} refined their value proposition and homepage positioning on ${params.url}, focusing on higher enterprise buyer alignment.`,
    key_takeaways: [
      "Hero copy updated to emphasize enterprise reliability and ROI.",
      "Customer social proof and logos refreshed.",
      "Call-to-action tuned towards requesting custom demos.",
    ],
    suggested_counter_action: `Audit our website headline tests and verify our search ad copy resonates more sharply with buyers seeking agile deployment.`,
  };
}

/**
 * Analyzes competitor changes between previous and new snapshots using OpenAI GPT-4o.
 */
export async function analyzeCompetitorDiff(params: {
  competitorName: string;
  url: string;
  oldContent?: string;
  newContent: string;
  diff?: string;
}): Promise<AIAnalysisResult> {
  const { competitorName, url, oldContent, newContent, diff } = params;

  if (isOpenAIConfigured && openAiKey) {
    try {
      const openai = new OpenAI({ apiKey: openAiKey });

      const systemPrompt = `You are CompetePulse's elite Competitive Intelligence AI Analyst.
Your goal is to inspect website delta changes for a competitor and extract concise, high-value executive intelligence.

OUTPUT FORMAT REQUIREMENTS:
You MUST respond with valid JSON matching this exact schema:
{
  "category": "pricing_change" | "feature_launch" | "messaging_shift" | "other",
  "impact_level": "HIGH" | "MEDIUM" | "LOW",
  "summary": "2-3 concise sentences explaining exactly what changed and the business intent.",
  "key_takeaways": [
    "First concrete bullet point with specific data/facts",
    "Second concrete bullet point",
    "Third concrete bullet point"
  ],
  "suggested_counter_action": "Specific, tactical counter-maneuver advice for our executive and marketing teams."
}`;

      const userPrompt = `Competitor: ${competitorName}
Target URL: ${url}

--- DIFF CONTENT ---
${diff || "First snapshot captured. Current page content:\n" + newContent.slice(0, 4000)}

--- PREVIOUS CONTENT SUMMARY ---
${oldContent ? oldContent.slice(0, 1500) : "No previous snapshot"}

--- NEW CONTENT SAMPLE ---
${newContent.slice(0, 3000)}

Analyze the business implications of this change and output structured JSON.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const responseText = response.choices[0]?.message?.content;
      if (responseText) {
        const parsed = JSON.parse(responseText) as AIAnalysisResult;

        // Sanitize and validate fields
        const validCategories = ["pricing_change", "feature_launch", "messaging_shift", "other"];
        const validImpacts = ["HIGH", "MEDIUM", "LOW"];

        return {
          category: validCategories.includes(parsed.category) ? parsed.category : "other",
          impact_level: validImpacts.includes(parsed.impact_level) ? parsed.impact_level : "MEDIUM",
          summary: parsed.summary || "Competitor update detected.",
          key_takeaways: Array.isArray(parsed.key_takeaways) && parsed.key_takeaways.length > 0
            ? parsed.key_takeaways.slice(0, 3)
            : ["Update detected on monitored page.", "Review live URL for full details."],
          suggested_counter_action: parsed.suggested_counter_action || "Monitor competitor traffic and buyer reactions.",
        };
      }
    } catch (err) {
      console.warn("[OpenAI GPT-4o analysis warning, using heuristic fallback]:", err);
    }
  }

  // Fallback heuristic analysis if OpenAI is unconfigured or call failed
  return generateHeuristicAnalysis({ competitorName, url, newContent, diff });
}
