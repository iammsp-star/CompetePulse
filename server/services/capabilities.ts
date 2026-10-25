import type { FeatureStatus } from '../../shared/types';

export const CAPABILITIES: { name: string; category: string }[] = [
  { name: 'AI copilot', category: 'AI' },
  { name: 'AI agents', category: 'AI' },
  { name: 'Forecasting', category: 'AI' },
  { name: 'Warehouse sync', category: 'Data' },
  { name: 'Real-time sync', category: 'Data' },
  { name: 'Custom dashboards', category: 'Analytics' },
  { name: 'Session replay', category: 'Analytics' },
  { name: 'Experimentation', category: 'Analytics' },
  { name: 'Workflow builder', category: 'Automation' },
  { name: 'Human approvals', category: 'Automation' },
  { name: 'Reverse ETL', category: 'Integrations' },
  { name: 'Public API', category: 'Integrations' },
  { name: 'Webhooks', category: 'Integrations' },
  { name: 'Marketplace', category: 'Integrations' },
  { name: 'SSO / SAML', category: 'Security' },
  { name: 'Audit logs', category: 'Security' },
  { name: 'Role-based access', category: 'Security' },
  { name: 'Mobile app', category: 'Platform' },
  { name: 'Sandbox environments', category: 'Platform' },
  { name: 'Slack alerts', category: 'Platform' },
];

/** Statuses are ordered exactly like CAPABILITIES. */
export const CAPABILITY_STATUS: Record<string, FeatureStatus[]> = {
  Orbitly: [
    'beta', 'none', 'planned', 'ga', 'ga', 'ga', 'none', 'none', 'planned', 'none',
    'ga', 'ga', 'ga', 'none', 'ga', 'ga', 'ga', 'none', 'none', 'ga',
  ],
  Stackline: [
    'planned', 'none', 'ga', 'ga', 'ga', 'ga', 'none', 'none', 'none', 'none',
    'none', 'ga', 'ga', 'planned', 'ga', 'ga', 'ga', 'planned', 'none', 'beta',
  ],
  'Northwind Labs': [
    'beta', 'beta', 'none', 'planned', 'ga', 'ga', 'none', 'none', 'ga', 'ga',
    'none', 'ga', 'ga', 'ga', 'ga', 'ga', 'ga', 'none', 'ga', 'ga',
  ],
  Cadence: [
    'planned', 'none', 'beta', 'ga', 'ga', 'ga', 'ga', 'ga', 'none', 'none',
    'none', 'ga', 'ga', 'planned', 'ga', 'beta', 'ga', 'beta', 'none', 'ga',
  ],
  'Relay AI': [
    'ga', 'ga', 'none', 'planned', 'ga', 'beta', 'none', 'none', 'beta', 'ga',
    'none', 'ga', 'ga', 'planned', 'ga', 'ga', 'ga', 'none', 'beta', 'ga',
  ],
  'Vantage Cloud': [
    'planned', 'none', 'beta', 'ga', 'beta', 'ga', 'none', 'none', 'none', 'none',
    'none', 'ga', 'beta', 'none', 'ga', 'ga', 'ga', 'none', 'none', 'ga',
  ],
};
