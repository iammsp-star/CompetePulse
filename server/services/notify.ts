import type { Impact, Insight, Notification, Settings } from '../../shared/types';
import { dbh, getSettings } from '../db';
import { nowIso, uid } from '../lib/util';

const IMPACT_RANK: Record<Impact, number> = { low: 0, medium: 1, high: 2 };

export interface ChannelResult {
  channel: 'slack' | 'email';
  status: 'sent' | 'simulated' | 'failed' | 'skipped';
  destination: string;
  detail: string;
}

function record(insight: Insight | null, competitorId: string | null, result: ChannelResult): Notification {
  const id = uid('ntf_');
  dbh.run(
    `INSERT INTO notifications (id, insight_id, competitor_id, channel, destination, status, detail, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    insight?.id ?? null,
    competitorId,
    result.channel,
    result.destination,
    result.status,
    result.detail,
    '',
    nowIso(),
  );
  return {
    id,
    insightId: insight?.id ?? null,
    competitorId,
    channel: result.channel,
    destination: result.destination,
    status: result.status,
    detail: result.detail,
    createdAt: nowIso(),
  };
}

function slackBlocks(insight: Insight): unknown[] {
  const emoji = insight.impact === 'high' ? '🔴' : insight.impact === 'medium' ? '🟠' : '🟡';
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${insight.competitorName}: ${insight.title}`.slice(0, 150) },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: insight.summary.slice(0, 2900) },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `*Impact:* ${insight.impact} · *Category:* ${insight.category} · *Confidence:* ${Math.round(insight.confidence * 100)}%` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Recommended action*\n${insight.recommendation}`.slice(0, 2900) },
    },
  ];
}

async function sendSlack(webhook: string, insight: Insight): Promise<ChannelResult> {
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `[${insight.impact.toUpperCase()}] ${insight.competitorName}: ${insight.title}`,
        blocks: slackBlocks(insight),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    if (!response.ok || !/ok|success/i.test(body)) {
      return { channel: 'slack', status: 'failed', destination: 'webhook', detail: `HTTP ${response.status}: ${body.slice(0, 180)}` };
    }
    return { channel: 'slack', status: 'sent', destination: 'webhook', detail: 'Delivered to Slack' };
  } catch (error) {
    return { channel: 'slack', status: 'failed', destination: 'webhook', detail: (error as Error).message.slice(0, 250) };
  }
}

async function sendEmail(to: string[], insight: Insight, settings: Settings): Promise<ChannelResult> {
  if (!process.env.RESEND_API_KEY) {
    return { channel: 'email', status: 'skipped', destination: to.join(', '), detail: 'RESEND_API_KEY is not configured' };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: settings.emailFrom,
        to,
        subject: `[${insight.impact.toUpperCase()}] ${insight.competitorName}: ${insight.title}`,
        text: `${insight.summary}\n\nRecommended action:\n${insight.recommendation}\n\n— CompetePulse`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const body = await response.text();
      return { channel: 'email', status: 'failed', destination: to.join(', '), detail: `HTTP ${response.status}: ${body.slice(0, 180)}` };
    }
    return { channel: 'email', status: 'sent', destination: to.join(', '), detail: 'Delivered via Resend' };
  } catch (error) {
    return { channel: 'email', status: 'failed', destination: to.join(', '), detail: (error as Error).message.slice(0, 250) };
  }
}

export function shouldNotify(insight: Insight, settings: Settings): boolean {
  return IMPACT_RANK[insight.impact] >= IMPACT_RANK[settings.alertMinImpact];
}

export async function deliverInsight(insight: Insight, settings = getSettings()): Promise<Notification[]> {
  if (!shouldNotify(insight, settings)) return [];
  const results: ChannelResult[] = [];
  const webhook = settings.slackWebhook || process.env.SLACK_WEBHOOK_URL || '';
  if (webhook) {
    results.push(await sendSlack(webhook, insight));
  } else {
    results.push({
      channel: 'slack',
      status: 'skipped',
      destination: 'not configured',
      detail: 'Add a Slack webhook in Settings to deliver alerts',
    });
  }

  const recipients = settings.emailRecipients
    .split(/[,;\n]/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (recipients.length) results.push(await sendEmail(recipients, insight, settings));

  const notifications = results.map((result) => record(insight, insight.competitorId, result));
  if (results.some((r) => r.status === 'sent' || r.status === 'simulated')) {
    dbh.run('UPDATE insights SET notified = 1 WHERE id = ?', insight.id);
  }
  return notifications;
}

export async function testSlack(webhook: string): Promise<ChannelResult> {
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'CompetePulse test alert — your competitive intelligence feed is connected. High-impact competitor moves will appear here.',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    if (!response.ok || !/ok|success/i.test(body)) {
      return { channel: 'slack', status: 'failed', destination: 'webhook', detail: `HTTP ${response.status}: ${body.slice(0, 180)}` };
    }
    return { channel: 'slack', status: 'sent', destination: 'webhook', detail: 'Test message delivered' };
  } catch (error) {
    return { channel: 'slack', status: 'failed', destination: 'webhook', detail: (error as Error).message.slice(0, 250) };
  }
}

export async function sendDigestNotification(
  markdown: string,
  title: string,
  settings = getSettings(),
): Promise<Notification[]> {
  const results: ChannelResult[] = [];
  const webhook = settings.slackWebhook || process.env.SLACK_WEBHOOK_URL || '';
  if (webhook) {
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `🗞️ ${title}\n\n${markdown.replace(/#+\s*/g, '').slice(0, 2800)}`,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.text();
      results.push({
        channel: 'slack',
        status: response.ok && /ok|success/i.test(body) ? 'sent' : 'failed',
        destination: 'webhook',
        detail: response.ok ? 'Digest delivered to Slack' : `HTTP ${response.status}: ${body.slice(0, 160)}`,
      });
    } catch (error) {
      results.push({ channel: 'slack', status: 'failed', destination: 'webhook', detail: (error as Error).message });
    }
  }
  const recipients = settings.emailRecipients
    .split(/[,;\n]/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (recipients.length) {
    if (!process.env.RESEND_API_KEY) {
      results.push({ channel: 'email', status: 'skipped', destination: recipients.join(', '), detail: 'RESEND_API_KEY is not configured' });
    } else {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from: settings.emailFrom,
            to: recipients,
            subject: title,
            text: markdown,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        results.push({
          channel: 'email',
          status: response.ok ? 'sent' : 'failed',
          destination: recipients.join(', '),
          detail: response.ok ? 'Digest delivered via Resend' : `HTTP ${response.status}`,
        });
      } catch (error) {
        results.push({ channel: 'email', status: 'failed', destination: recipients.join(', '), detail: (error as Error).message });
      }
    }
  }
  if (!results.length) {
    results.push({ channel: 'slack', status: 'skipped', destination: 'not configured', detail: 'No Slack webhook or email recipients configured' });
  }
  return results.map((result) => record(null, null, result));
}
