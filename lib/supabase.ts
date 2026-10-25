import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface Competitor {
  id: string;
  name: string;
  domain?: string;
  category?: string;
  description?: string;
  logo_url?: string;
  created_at: string;
  targets?: MonitoredTarget[];
}

export interface MonitoredTarget {
  id: string;
  competitor_id: string;
  url: string;
  target_type: "pricing" | "features" | "changelog" | "homepage" | "other";
  check_frequency: "hourly" | "daily" | "weekly";
  last_scraped_at?: string;
  last_status?: "pending" | "active" | "changed" | "error";
  created_at: string;
}

export interface Snapshot {
  id: string;
  target_id: string;
  content_markdown: string;
  content_hash: string;
  http_status?: number;
  metadata?: Record<string, unknown>;
  scraped_at: string;
}

export interface Insight {
  id: string;
  target_id: string;
  competitor_id: string;
  category: "pricing_change" | "feature_launch" | "messaging_shift" | "other";
  impact_level: "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  key_takeaways: string[];
  suggested_counter_action: string;
  diff_content?: string;
  old_hash?: string;
  new_hash?: string;
  created_at: string;
  competitor_name?: string;
  target_url?: string;
}

// In-Memory store for offline fallback / unconfigured state
const memoryStore = {
  competitors: [
    {
      id: "comp-1",
      name: "Acme Cloud Analytics",
      domain: "acmecloud.io",
      category: "Analytics & Observability",
      description: "Leading enterprise observability and real-time event analytics suite.",
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "comp-2",
      name: "DevVortex",
      domain: "devvortex.com",
      category: "Developer Tools",
      description: "Collaborative CI/CD pipeline optimization and automated developer workflows.",
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: "comp-3",
      name: "OmniCRM Global",
      domain: "omnicrm.app",
      category: "Sales & CRM",
      description: "AI-assisted enterprise sales orchestration and customer tracking platform.",
      created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    },
  ] as Competitor[],

  targets: [
    {
      id: "target-1",
      competitor_id: "comp-1",
      url: "https://acmecloud.io/pricing",
      target_type: "pricing" as const,
      check_frequency: "hourly" as const,
      last_scraped_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      last_status: "changed" as const,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "target-2",
      competitor_id: "comp-2",
      url: "https://devvortex.com/features",
      target_type: "features" as const,
      check_frequency: "daily" as const,
      last_scraped_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      last_status: "changed" as const,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: "target-3",
      competitor_id: "comp-3",
      url: "https://omnicrm.app/pricing",
      target_type: "pricing" as const,
      check_frequency: "daily" as const,
      last_scraped_at: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
      last_status: "active" as const,
      created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    },
  ] as MonitoredTarget[],

  snapshots: [
    {
      id: "snap-1",
      target_id: "target-1",
      content_markdown: `# Acme Cloud Analytics - Pricing Plans\n\n## Starter Plan\n- $0/month\n- 10,000 monthly events\n- 1 seat\n\n## Pro Plan\n- $89/month (formerly $49/mo)\n- 1,000,000 events\n- Unlimited seats\n- Real-time ingestion: $0.10/GB overage\n\n## Enterprise Plan\n- Custom annual pricing\n- 99.99% SLA\n- Dedicated CSM`,
      content_hash: "a3f81e9b1104e1bc2a014902b48d",
      scraped_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    },
    {
      id: "snap-2",
      target_id: "target-2",
      content_markdown: `# DevVortex Features & Capabilities\n\n## AI Automated PR Reviewer (NEW)\n- Automatically scans GitHub and GitLab pull requests\n- Instant security compliance and performance benchmarks\n\n## Enterprise CI/CD Acceleration\n- Distributed caching\n- On-premise runner support`,
      content_hash: "7f4c9103e83910cd8b12f91",
      scraped_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
  ] as Snapshot[],

  insights: [
    {
      id: "insight-1",
      target_id: "target-1",
      competitor_id: "comp-1",
      category: "pricing_change" as const,
      impact_level: "HIGH" as const,
      summary: "Acme Cloud increased their popular Pro plan by 81% (from $49/mo to $89/mo) and introduced strict overage pricing for log ingestion ($0.10/GB).",
      key_takeaways: [
        "Entry Pro tier increased drastically from $49/mo to $89/mo.",
        "Unbundled real-time ingestion into a usage-based fee ($0.10/GB over 50GB).",
        "Discontinued open-ended free trial in favor of a 14-day limit.",
      ],
      suggested_counter_action: "Launch a competitive displacement campaign highlighting our flat-rate $49 Pro tier with no log ingestion penalties.",
      diff_content: `--- Previous Pricing\n+++ Acme New Pricing\n- Pro Plan: $49/month\n+ Pro Plan: $89/month (Billed annually or monthly)\n- Free Log Ingestion: Included\n+ Real-time Ingestion: $0.10/GB over 50GB limit\n- 30-Day Money Back Guarantee\n+ 14-Day Free Trial`,
      created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      competitor_name: "Acme Cloud Analytics",
      target_url: "https://acmecloud.io/pricing",
    },
    {
      id: "insight-2",
      target_id: "target-2",
      competitor_id: "comp-2",
      category: "feature_launch" as const,
      impact_level: "MEDIUM" as const,
      summary: "DevVortex launched an AI Automated PR Review bot and announced native support for on-premise GitLab Enterprise instances.",
      key_takeaways: [
        "Directly competing with automated code review assistants.",
        "Targeting security-conscious enterprise teams requiring on-premise deployment.",
        "Marketing messaging shifted toward DevSecOps automation.",
      ],
      suggested_counter_action: "Accelerate our roadmap for AI test generation and create a dedicated comparison page highlighting our faster CI runner speeds.",
      diff_content: `--- Previous Features\n+++ DevVortex Current Features\n+ ## AI Automated PR Reviewer (NEW)\n+ - Automated scans for GitLab & GitHub\n+ - Security compliance checks`,
      created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      competitor_name: "DevVortex",
      target_url: "https://devvortex.com/features",
    },
  ] as Insight[],
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("https://") &&
  !supabaseUrl.includes("your-project.supabase.co") &&
  supabaseAnonKey !== "your-anon-key-here"
);

let _supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_supabaseClient && supabaseUrl && supabaseAnonKey) {
    _supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabaseClient;
}

// -------------------------------------------------------------
// Unified Data Access Layer (with automatic graceful fallback)
// -------------------------------------------------------------

export async function fetchCompetitorsWithTargets(): Promise<Competitor[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: competitors, error: compError } = await client
        .from("competitors")
        .select("*")
        .order("created_at", { ascending: false });

      if (compError) throw compError;

      const { data: targets, error: targetError } = await client
        .from("monitored_targets")
        .select("*");

      if (targetError) throw targetError;

      return (competitors || []).map((comp) => ({
        ...comp,
        targets: (targets || []).filter((t) => t.competitor_id === comp.id),
      }));
    } catch (err) {
      console.warn("Supabase fetch failed, falling back to local memory store:", err);
    }
  }

  // Fallback
  return memoryStore.competitors.map((c) => ({
    ...c,
    targets: memoryStore.targets.filter((t) => t.competitor_id === c.id),
  }));
}

export async function addCompetitor(params: {
  name: string;
  url: string;
  category?: string;
  target_type?: "pricing" | "features" | "changelog" | "homepage" | "other";
}): Promise<{ competitor: Competitor; target: MonitoredTarget }> {
  let domain = "";
  try {
    const parsed = new URL(params.url);
    domain = parsed.hostname.replace(/^www\./, "");
  } catch {
    domain = params.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: comp, error: compErr } = await client
        .from("competitors")
        .insert({
          name: params.name,
          domain,
          category: params.category || "SaaS",
          description: `Monitored competitor ${params.name}`,
        })
        .select()
        .single();

      if (compErr) throw compErr;

      const { data: target, error: targetErr } = await client
        .from("monitored_targets")
        .insert({
          competitor_id: comp.id,
          url: params.url,
          target_type: params.target_type || "pricing",
          check_frequency: "hourly",
          last_status: "pending",
        })
        .select()
        .single();

      if (targetErr) throw targetErr;

      return {
        competitor: { ...comp, targets: [target] },
        target,
      };
    } catch (err) {
      console.warn("Supabase insert failed, storing in memory fallback:", err);
    }
  }

  // Fallback
  const newComp: Competitor = {
    id: `comp-${Date.now()}`,
    name: params.name,
    domain,
    category: params.category || "SaaS",
    description: `Monitored competitor ${params.name}`,
    created_at: new Date().toISOString(),
  };

  const newTarget: MonitoredTarget = {
    id: `target-${Date.now()}`,
    competitor_id: newComp.id,
    url: params.url,
    target_type: params.target_type || "pricing",
    check_frequency: "hourly",
    last_status: "pending",
    created_at: new Date().toISOString(),
  };

  memoryStore.competitors.unshift(newComp);
  memoryStore.targets.unshift(newTarget);

  return {
    competitor: { ...newComp, targets: [newTarget] },
    target: newTarget,
  };
}

export async function fetchInsights(): Promise<Insight[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("insights")
        .select(`
          *,
          competitor:competitors(name),
          target:monitored_targets(url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((item) => ({
        ...item,
        competitor_name: item.competitor?.name,
        target_url: item.target?.url,
      }));
    } catch (err) {
      console.warn("Supabase insights fetch failed, falling back to local memory store:", err);
    }
  }

  // Fallback
  return memoryStore.insights.map((insight) => {
    const comp = memoryStore.competitors.find((c) => c.id === insight.competitor_id);
    const target = memoryStore.targets.find((t) => t.id === insight.target_id);
    return {
      ...insight,
      competitor_name: comp?.name || insight.competitor_name,
      target_url: target?.url || insight.target_url,
    };
  });
}

export async function getLatestSnapshot(targetId: string): Promise<Snapshot | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("snapshots")
        .select("*")
        .eq("target_id", targetId)
        .order("scraped_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) return data;
    } catch (err) {
      console.warn("Supabase snapshot lookup failed, falling back:", err);
    }
  }

  const found = memoryStore.snapshots
    .filter((s) => s.target_id === targetId)
    .sort((a, b) => new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime())[0];

  return found || null;
}

export async function saveSnapshot(snapshot: Omit<Snapshot, "id" | "scraped_at">): Promise<Snapshot> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("snapshots")
        .insert(snapshot)
        .select()
        .single();

      if (!error && data) return data;
    } catch (err) {
      console.warn("Supabase snapshot save failed:", err);
    }
  }

  const created: Snapshot = {
    ...snapshot,
    id: `snap-${Date.now()}`,
    scraped_at: new Date().toISOString(),
  };
  memoryStore.snapshots.unshift(created);
  return created;
}

export async function saveInsight(insight: Omit<Insight, "id" | "created_at">): Promise<Insight> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("insights")
        .insert(insight)
        .select(`
          *,
          competitor:competitors(name),
          target:monitored_targets(url)
        `)
        .single();

      if (!error && data) {
        return {
          ...data,
          competitor_name: data.competitor?.name,
          target_url: data.target?.url,
        };
      }
    } catch (err) {
      console.warn("Supabase insight save failed:", err);
    }
  }

  const comp = memoryStore.competitors.find((c) => c.id === insight.competitor_id);
  const target = memoryStore.targets.find((t) => t.id === insight.target_id);

  const created: Insight = {
    ...insight,
    id: `insight-${Date.now()}`,
    created_at: new Date().toISOString(),
    competitor_name: comp?.name || "Competitor",
    target_url: target?.url || "",
  };

  memoryStore.insights.unshift(created);
  return created;
}

export async function updateTargetStatus(
  targetId: string,
  status: "pending" | "active" | "changed" | "error"
): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from("monitored_targets")
        .update({ last_status: status, last_scraped_at: new Date().toISOString() })
        .eq("id", targetId);
    } catch (err) {
      console.warn("Failed to update target status in Supabase:", err);
    }
  }

  const target = memoryStore.targets.find((t) => t.id === targetId);
  if (target) {
    target.last_status = status;
    target.last_scraped_at = new Date().toISOString();
  }
}
