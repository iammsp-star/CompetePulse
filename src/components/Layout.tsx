import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  Bell,
  BrainCircuit,
  ChevronRight,
  Columns3,
  LayoutDashboard,
  Menu,
  Newspaper,
  RefreshCw,
  Settings as SettingsIcon,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import type { ProviderStatus, Stats } from '../../shared/types';
import { api } from '../lib/api';
import { emitRefresh, useRefreshListener } from '../lib/events';
import { relativeTime } from '../lib/format';
import { useToast } from './Toast';
import { StatusDot } from './ui';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/feed', label: 'Intelligence feed', icon: Newspaper, badge: 'alerts' },
  { to: '/competitors', label: 'Competitors', icon: Target },
  { to: '/matrix', label: 'Feature matrix', icon: Columns3 },
  { to: '/ask', label: 'Ask CompetePulse', icon: Sparkles },
  { to: '/digest', label: 'Weekly briefing', icon: BrainCircuit },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const CRUMBS: Record<string, string> = {
  '': 'Overview',
  feed: 'Intelligence feed',
  competitors: 'Competitors',
  matrix: 'Feature matrix',
  ask: 'Ask CompetePulse',
  digest: 'Weekly briefing',
  settings: 'Settings',
};

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const [scanning, setScanning] = useState(false);
  const location = useLocation();
  const toast = useToast();

  const load = () => {
    api.stats().then(setStats).catch(() => undefined);
    api
      .settings()
      .then((result) => setProviders(result.providers))
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, [location.pathname]);

  useEffect(() => useRefreshListener(load), []);

  const scanAll = async () => {
    setScanning(true);
    try {
      const result = await api.scan({});
      const found = result.insights ?? 0;
      const scanned = result.scanned ?? result.results?.length ?? 0;
      toast.push(
        scanned
          ? `Scanned ${scanned} page${scanned === 1 ? '' : 's'}${found ? ` · ${found} new insight${found === 1 ? '' : 's'}` : ' · no material changes'}`
          : 'No pages were scanned',
        'success',
      );
      emitRefresh();
      load();
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const segments = location.pathname.split('/').filter(Boolean);
  const crumb = segments.length === 0 ? 'Overview' : segments[0] === 'competitors' && segments[1] ? 'Competitor detail' : CRUMBS[segments[0]] ?? 'Workspace';
  const lastScan = stats?.lastRun?.finishedAt ?? stats?.lastRun?.startedAt;

  return (
    <div className="app-shell">
      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
              <path d="M5 21l5-7 4 3 5-9 6 13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="brand-name">CompetePulse</div>
            <div className="brand-tag">Competitive intelligence</div>
          </div>
          <button className="icon-btn sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X size={17} />
          </button>
        </div>

        <nav className="nav">
          <span className="nav-label">Workspace</span>
          {NAV.map((item) => {
            const Icon = item.icon;
            const alertCount = item.badge === 'alerts' ? stats?.unreadAlerts ?? 0 : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-row">
              <span className="system-title">Monitoring</span>
              <StatusDot tone={providers ? 'ok' : 'warn'} pulse />
            </div>
            <div className="system-stats">
              <strong>{stats?.competitors ?? '—'}</strong> competitors
              <span className="dot-sep">·</span>
              <strong>{stats?.monitoredPages ?? '—'}</strong> pages
            </div>
            <div className="system-line">
              <StatusDot tone="ok" />
              Scheduler active · next {stats?.nextRun ? relativeTime(stats.nextRun) : 'queued'}
            </div>
            <div className="system-line">
              <StatusDot tone={providers?.llm.live ? 'ok' : 'muted'} />
              {providers?.llm.live ? 'LLM synthesis online' : 'Rubric engine active'}
            </div>
            <NavLink to="/settings" className="system-link">
              Provider status <ArrowUpRight size={12} />
            </NavLink>
          </div>
          <div className="sidebar-foot">Competitive intel workspace · v1.0</div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu size={18} />
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{crumb}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <span className="last-scan">
              <RefreshCw size={12} />{' '}
              {lastScan ? `Synced ${relativeTime(lastScan)}` : `Monitoring ${stats?.monitoredPages ?? 0} pages`}
            </span>
            <NavLink to="/feed" className="icon-btn alert-btn" aria-label="High-impact alerts">
              <Bell size={17} />
              {(stats?.unreadAlerts ?? 0) > 0 && <span className="alert-count">{stats?.unreadAlerts}</span>}
            </NavLink>
            <button type="button" className={`btn btn-primary btn-sm ${scanning ? 'btn-loading' : ''}`} onClick={scanAll} disabled={scanning}>
              <RefreshCw size={14} className={scanning ? 'spin' : ''} />
              {scanning ? 'Scanning…' : 'Scan all'}
            </button>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
