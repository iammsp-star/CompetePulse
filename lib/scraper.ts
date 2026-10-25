import crypto from "crypto";
import { createTwoFilesPatch } from "diff";
import FirecrawlApp from "@mendable/firecrawl-js";

export interface ScrapeResult {
  url: string;
  markdown: string;
  hash: string;
  hasChanged: boolean;
  diff?: string;
  source: "firecrawl" | "web_fetch" | "simulation";
  previousHash?: string;
}

const firecrawlKey = process.env.FIRECRAWL_API_KEY;
export const isFirecrawlConfigured = Boolean(
  firecrawlKey &&
  firecrawlKey !== "your-firecrawl-api-key-here" &&
  firecrawlKey.trim().length > 5
);

/**
 * Calculates SHA-256 hash of string content
 */
export function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content.trim()).digest("hex");
}

/**
 * Generates unified line-by-line diff between old and new markdown
 */
export function generateDiff(oldText: string, newText: string, fileName = "page.md"): string {
  if (!oldText) {
    return newText
      .split("\n")
      .map((line) => `+ ${line}`)
      .join("\n");
  }

  const patch = createTwoFilesPatch(
    `Previous ${fileName}`,
    `Current ${fileName}`,
    oldText,
    newText,
    "",
    ""
  );

  // Return clean diff lines
  const lines = patch.split("\n");
  return lines.slice(4).join("\n"); // Skip diff header metadata
}

/**
 * Simulates dynamic competitor page markdown updates for live demonstration
 * when mock/demo domains are tested.
 */
function getSimulatedPage(url: string, iteration = 0): string {
  const normalized = url.toLowerCase();
  const timestamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (normalized.includes("pricing")) {
    const proPrice = iteration % 2 === 0 ? "$89/mo" : "$99/mo";
    const enterpriseFeature = iteration % 2 === 0 
      ? "- Dedicated Customer Success Manager\n- Custom SLAs"
      : "- Dedicated Customer Success Manager\n- 24/7 Phone Support & Custom SLAs\n- AI Agent Fleet Ingestion included";

    return `# Acme Cloud Analytics — Official Pricing (${timestamp})
*Transparent, scalable pricing designed for hyper-growth engineering teams.*

## Plans Overview
- **Starter Plan**: $0 / month (Up to 10,000 monthly events, 1 user seat)
- **Growth Pro**: ${proPrice} (1,000,000 events, 5 seats, Slack & PagerDuty alerts)
- **Enterprise**: Custom annual contract

### Usage Overages
- Real-time ingestion: $0.12 per GB beyond allotted tier limit.
- Cold storage retention: $0.03 per GB/mo.

### Recent Updates
- Free trial duration updated to 14 days.
${enterpriseFeature}
`;
  }

  if (normalized.includes("feature") || normalized.includes("changelog")) {
    const isNew = iteration % 2 === 0;
    return `# DevVortex Changelog & Features (${timestamp})

## Latest Product Releases
${isNew ? "### v4.2.0 - Automated AI Pull Request Reviews (NEW)\n- Instant security compliance and code smell detection on every GitHub & GitLab PR.\n- Decreases team review turnaround by 42%.\n" : ""}
### v4.1.0 - Distributed Build Caching
- Faster CI/CD runner execution with remote Redis and S3 caching backends.
- Enterprise SSO: Okta, Azure AD, and Google Workspace support.

## Security & Compliance
- SOC2 Type II Certified
- GDPR & HIPAA Compliant infrastructure
`;
  }

  return `# ${url} - Monitored Overview (${timestamp})
## Company Capabilities & Offerings
- Next-generation cloud software and autonomous workflows.
- Real-time intelligence and automated reporting.
- Contact sales for custom enterprise onboarding.
`;
}

/**
 * Core scraping engine:
 * 1. Scrapes target URL using Firecrawl (or fallback fetch/simulator)
 * 2. Computes SHA-256 hash
 * 3. Compares with previous hash to skip redundant AI calls
 */
export async function scrapeTargetUrl(
  url: string,
  previousSnapshot?: { content_markdown: string; content_hash: string } | null
): Promise<ScrapeResult> {
  let markdown = "";
  let source: ScrapeResult["source"] = "firecrawl";

  // 1. Attempt Firecrawl if API key is provided
  if (isFirecrawlConfigured && firecrawlKey) {
    try {
      const app = new FirecrawlApp({ apiKey: firecrawlKey });
      const scrapeResponse = await app.scrapeUrl(url, {
        formats: ["markdown"],
      });

      if (scrapeResponse && scrapeResponse.success && (scrapeResponse as any).markdown) {
        markdown = (scrapeResponse as any).markdown;
        source = "firecrawl";
      } else {
        throw new Error((scrapeResponse as any)?.error || "Firecrawl returned empty markdown");
      }
    } catch (err) {
      console.warn(`[Firecrawl API warning for ${url}]:`, err);
      // Fall through to fallback
    }
  }

  // 2. Fallback: If Firecrawl is not configured or failed, attempt basic fetch or simulation
  if (!markdown) {
    try {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        // Attempt basic web fetch
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CompetePulse/1.0",
          },
        });
        clearTimeout(timeout);

        if (res.ok) {
          const text = await res.text();
          // Extract text cleanly without scripts/styles
          const cleanText = text
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (cleanText.length > 100) {
            markdown = `# Scraped from ${url}\n\n${cleanText.slice(0, 10000)}`;
            source = "web_fetch";
          }
        }
      }
    } catch (err) {
      console.warn(`Direct fetch fallback for ${url} failed, using intelligent simulation:`, err);
    }
  }

  // 3. Fallback to simulation if still empty
  if (!markdown) {
    const randomIteration = Math.floor(Date.now() / 10000);
    markdown = getSimulatedPage(url, randomIteration);
    source = "simulation";
  }

  // 4. Compute SHA-256 Hash
  const currentHash = computeHash(markdown);
  const previousHash = previousSnapshot?.content_hash;

  // 5. Hash Comparison Check
  const hasChanged = !previousHash || currentHash !== previousHash;
  let diff: string | undefined = undefined;

  if (hasChanged && previousSnapshot?.content_markdown) {
    diff = generateDiff(previousSnapshot.content_markdown, markdown);
  } else if (!previousSnapshot) {
    diff = `+ [Initial Snapshot Captured for ${url}]\n+ Content size: ${markdown.length} characters`;
  }

  return {
    url,
    markdown,
    hash: currentHash,
    hasChanged,
    diff,
    source,
    previousHash,
  };
}
