require('dotenv').config({ path: 'C:\\Users\\gpghe\\.env.shared' });
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const { google } = require('googleapis');

let _sheetsCl = null;
function getSh() {
  if (_sheetsCl) return _sheetsCl;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    const auth = new google.auth.JWT({ email: c.client_email, key: c.private_key, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    _sheetsCl = google.sheets({ version: 'v4', auth });
    return _sheetsCl;
  } catch { return null; }
}
async function readSh(tab) {
  const s = getSh(); const id = process.env.GOOGLE_SHEETS_ID;
  if (!s || !id) return [];
  try {
    const res = await s.spreadsheets.values.get({ spreadsheetId: id, range: `'${tab}'!A:ZZ` });
    const rows = res.data.values || [];
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => String(h).toLowerCase().replace(/\s+/g, '_'));
    return rows.slice(1).map(row => { const o = {}; headers.forEach((h, i) => { o[h] = row[i] || ''; }); return o; });
  } catch { return []; }
}

// ─── VERSION + DEPLOY TIMESTAMP ───────────────────────────────────────────
const APP_VERSION = 'v1.0';
const LAST_DEPLOY = 'April 16, 2026 11:27 PM EST';
// ──────────────────────────────────────────────────────────────────────────

const app = express();
app.set('trust proxy', 1);
app.use(generalLimiter);
const PORT = process.env.PORT || 3007;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'brokercommand2026',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }
}));

// PwP family + Marketing Command (coming soon)
const PWP_FAMILY = [
  { name: 'REI Homepage',        badge: 'RH', href: 'https://gorilla-ai-production.up.railway.app',                    tag: 'Deal analysis + inspection + comms' },
  { name: 'Transaction Command', badge: 'TC', href: 'https://transaction-command-production.up.railway.app',           tag: 'Transaction compliance + document review' },
  { name: 'Agent Command',       badge: 'AC', href: 'https://agent-command-production.up.railway.app',                 tag: 'Agent onboarding + training + roster' },
  { name: 'Lender Command',      badge: 'LC', href: 'https://lender-command-production.up.railway.app',                tag: 'Private lending intake + DSCR + AI UW' },
  { name: 'Data Command',        badge: 'DC', href: 'https://data-command-production.up.railway.app',                  tag: 'Real estate data + skip trace + lists' }
];
const MARKETING_COMMAND = {
  name: 'Marketing Command',
  badge: 'MC',
  eta: 'Q2 2026',
  tag: 'CRM, phone, SMS, email — pre-integrated comm stack for brokerages.'
};

// Recruiting prospects are loaded live from the "Recruiting Pipeline" Google Sheet tab.
// No prospect data is stored in source code.
// Fallback: empty array when Sheets is unavailable.
async function getProspects() {
  const rows = await readSh('Recruiting Pipeline');
  if (!rows.length) return [];
  return rows.map((r, i) => ({
    id:        r.id        || ('p_live_' + i),
    stage:     (r.stage    || 'sourced').toLowerCase().trim(),
    name:      r.name      || '',
    brokerage: r.brokerage || '—',
    state:     (r.state    || '').toUpperCase(),
    gci:       parseInt(r.gci, 10) || 0,
    days:      parseInt(r.days, 10) || 0,
    lastTouch: r.last_touch || r.lasttouch || '',
    source:    r.source    || '',
    hot:       String(r.hot).toLowerCase() === 'true',
    note:      r.note      || ''
  }));
}

const mcNotifyList = [];

// Locals
app.use((req, res, next) => {
  res.locals.version = APP_VERSION;
  res.locals.lastUpdated = LAST_DEPLOY;
  res.locals.appName = 'Broker Command';
  res.locals.currentPath = req.path;
  res.locals.isLoggedIn = !!(req.session && req.session.isBroker);
  res.locals.pwpFamily = PWP_FAMILY;
  res.locals.marketingCommand = MARKETING_COMMAND;
  next();
});

function requireAuth(req, res, next) {
  if (req.session && req.session.isBroker) return next();
  return res.redirect('/login');
}

// ─── AUTH ──────────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.session.isBroker) return res.redirect('/dashboard');
  res.render('layout', { page: 'login', title: 'Sign In — Broker Command', error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if ((username || '').trim().toLowerCase() === 'broker' && password === (process.env.ADMIN_PASSWORD || '')) {
    req.session.isBroker = true;
    return res.redirect('/dashboard');
  }
  res.status(401).render('layout', { page: 'login', title: 'Sign In — Broker Command', error: 'Invalid credentials.' });
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

app.get('/', (req, res) => res.redirect(req.session.isBroker ? '/dashboard' : '/login'));

// ─── DASHBOARD — live from Properties + Closing Pipeline + Licensed Agents ──
app.get('/dashboard', requireAuth, async (req, res) => {
  let pipelineRows = [], agentRows = [], propRows = [];
  try {
    [pipelineRows, agentRows, propRows] = await Promise.all([
      readSh('Closing Pipeline'), readSh('Licensed Agents'), readSh('Properties')
    ]);
  } catch { /* fall through */ }

  const activeAgents = agentRows.filter(r => (r.status || 'active').toLowerCase().includes('active'));
  const closedDeals = pipelineRows.filter(r => (r.stage || r.status || '').toLowerCase().includes('closed'));
  const activeDeals = pipelineRows.filter(r => !(r.stage || r.status || '').toLowerCase().includes('closed'));

  // Compute top agents from Closing Pipeline submitter attribution
  const agentStats = {};
  for (const row of closedDeals) {
    const name = row.submitter_name || row.agent_name || row.assigned_to || 'Team';
    if (!agentStats[name]) agentStats[name] = { txns: 0 };
    agentStats[name].txns++;
  }
  const topAgents = Object.entries(agentStats).sort((a, b) => b[1].txns - a[1].txns).slice(0, 5).map(([name, data], i) => ({
    rank: i + 1, name, txns: data.txns, gci: 'See Leaderboard', trend: '→'
  }));
  if (!topAgents.length) topAgents.push({ rank: 1, name: 'No closed deals yet', txns: 0, gci: '--', trend: '--' });

  const stats = [
    { label: 'Active Agents',      value: String(activeAgents.length || agentRows.length), delta: `${agentRows.filter(r => (r.status||'').toLowerCase().includes('onboarding')).length} in onboarding`, deltaClass: 'delta-muted' },
    { label: 'Active Deals',       value: String(activeDeals.length), delta: `${closedDeals.length} closed`, deltaClass: 'delta-muted' },
    { label: 'New Leads',          value: String(propRows.length), delta: 'From all intake sources', deltaClass: 'delta-muted' },
    { label: 'Data Source',        value: process.env.GOOGLE_SHEETS_ID ? 'Live (Sheets)' : 'No Sheet ID', delta: '', deltaClass: 'delta-muted' }
  ];

  const attention = activeDeals.filter(r => {
    const stage = (r.stage || r.status || '').toLowerCase();
    return stage.includes('stuck') || stage.includes('review');
  }).slice(0, 5).map(r => `${r.property_address || r.address || 'Deal'} — ${r.stage || r.status || 'needs review'}`);

  if (!attention.length) attention.push('No items requiring attention');

  const healthScore = {
    total: activeAgents.length > 0 ? 82 : 60,
    breakdown: [
      { label: 'Agent roster', score: agentRows.length > 3 ? 90 : 60, color: agentRows.length > 3 ? 'green' : 'orange' },
      { label: 'Pipeline',     score: activeDeals.length > 0 ? 85 : 50, color: activeDeals.length > 0 ? 'green' : 'orange' },
      { label: 'Lead volume',  score: propRows.length > 5 ? 88 : 65, color: propRows.length > 5 ? 'green' : 'orange' },
    ]
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  res.render('layout', { page: 'dashboard', title: 'Executive Dashboard — Broker Command', stats, topAgents, healthScore, attention, today });
});

// ─── RECRUITING ────────────────────────────────────────────────────────────
app.get('/recruiting', requireAuth, async (req, res) => {
  let prospects = [];
  try { prospects = await getProspects(); } catch { /* fallback: empty */ }
  const stages = {
    sourced:      prospects.filter(p => p.stage === 'sourced'),
    contacted:    prospects.filter(p => p.stage === 'contacted'),
    conversation: prospects.filter(p => p.stage === 'conversation'),
    offer:        prospects.filter(p => p.stage === 'offer')
  };
  const metrics = {
    conversion_rate: '18%',
    avg_days: 47,
    top_source: 'Referrals (62%)',
    cost_per_acquisition: '$340'
  };
  res.render('layout', {
    page: 'recruiting',
    title: 'Recruiting Pipeline — Broker Command',
    stages, metrics
  });
});

// NOTE: /recruiting/add, /move, /lose, /convert are write operations.
// Prospect data lives in Google Sheets; these endpoints return acknowledgement
// responses and rely on the operator to update the Sheet directly.
// A full Sheets write-back integration is a v2 enhancement.
app.post('/recruiting/add', requireAuth, (req, res) => {
  const { name, brokerage, state, gci, source } = req.body;
  if (!name) return res.redirect('/recruiting');
  // Prospect is added to Sheet by operator; this confirms receipt.
  console.log(`[recruiting/add] New prospect submitted: ${name.trim()} — update Recruiting Pipeline Sheet to persist.`);
  res.redirect('/recruiting');
});

app.post('/recruiting/:id/move', requireAuth, async (req, res) => {
  const { direction } = req.body;
  let prospects = [];
  try { prospects = await getProspects(); } catch { /* fallback */ }
  const prospect = prospects.find(p => p.id === req.params.id);
  if (!prospect) return res.status(404).json({ error: 'not found' });
  const order = ['sourced', 'contacted', 'conversation', 'offer'];
  const idx = order.indexOf(prospect.stage);
  let newStage = prospect.stage;
  if (direction === 'next' && idx < order.length - 1) newStage = order[idx + 1];
  if (direction === 'prev' && idx > 0) newStage = order[idx - 1];
  console.log(`[recruiting/move] ${prospect.name} → ${newStage} — update Recruiting Pipeline Sheet to persist.`);
  res.json({ ok: true, stage: newStage });
});

app.post('/recruiting/:id/lose', requireAuth, async (req, res) => {
  let prospects = [];
  try { prospects = await getProspects(); } catch { /* fallback */ }
  const prospect = prospects.find(p => p.id === req.params.id);
  console.log(`[recruiting/lose] ${prospect ? prospect.name : req.params.id} marked lost — update Recruiting Pipeline Sheet to persist.`);
  res.json({ ok: true });
});

app.post('/recruiting/:id/convert', requireAuth, async (req, res) => {
  let prospects = [];
  try { prospects = await getProspects(); } catch { /* fallback */ }
  const prospect = prospects.find(p => p.id === req.params.id);
  if (!prospect) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true, handoff_target: 'agent-command', placeholder: true, message: `${prospect.name} would be handed off to Agent Command onboarding — v2 wiring.` });
});

// ─── MARKETING ─────────────────────────────────────────────────────────────
app.get('/marketing', requireAuth, (req, res) => {
  const stats = [
    { label: 'Active Campaigns',         value: '5'   },
    { label: 'Leads Generated MTD',      value: '47'  },
    { label: 'Recruit Inquiries MTD',    value: '12'  },
    { label: 'Marketing Spend MTD',      value: '$2,340' }
  ];

  const campaigns = [
    { name: 'NEPA First-Time Buyers',   type: 'Facebook',  audience: 'Consumer', spend: '$480', leads: 18, status: 'Active' },
    { name: 'Wilkes-Barre Listings',    type: 'Google Ads', audience: 'Consumer', spend: '$720', leads: 22, status: 'Active' },
    { name: 'Recruit Top Producers',    type: 'LinkedIn',   audience: 'Recruit',  spend: '$390', leads: 7,  status: 'Active' },
    { name: 'YouTube Education Series', type: 'Organic',    audience: 'Both',     spend: '$0',   leads: 5,  status: 'Active' },
    { name: 'Spring Open House Push',   type: 'Email',      audience: 'Consumer', spend: '$40',  leads: 7,  status: 'Active' }
  ];

  const brandAssets = [
    { name: 'Logo — Light',                type: 'Logo' },
    { name: 'Logo — Dark',                 type: 'Logo' },
    { name: 'Logo — Horizontal',           type: 'Logo' },
    { name: 'Logo — Vertical',             type: 'Logo' },
    { name: 'Email Signature Template',    type: 'Template' },
    { name: 'Yard Sign Template',          type: 'Template' },
    { name: 'Business Card Template',      type: 'Template' },
    { name: 'Social Media Post Pack (10)', type: 'Template' },
    { name: 'Listing Flyer Template',      type: 'Template' },
    { name: 'Just Sold Template',          type: 'Template' },
    { name: 'Open House Template',         type: 'Template' },
    { name: 'Recruitment One-Pager',       type: 'Recruiting' }
  ];

  const recruitingAssets = [
    { name: 'Why Gorilla One-Pager',              type: 'PDF' },
    { name: 'Plan A / B / C Comparison Sheet',    type: 'PDF' },
    { name: 'Earnings Calculator (Plan A vs 70/30)', type: 'Tool' },
    { name: 'Agent Testimonial Videos',           type: 'Video' },
    { name: 'Recruit Landing Page (/join)',       type: 'Link' },
    { name: 'Recruit Email Drip (5-email sequence)', type: 'Email' },
    { name: 'LinkedIn Outreach Templates',        type: 'Template' }
  ];

  const contentCalendar = buildContentCalendar();

  const roi = {
    cost_per_consumer_lead: '$26',
    cost_per_recruit_lead: '$56',
    best_channel: 'Google Ads (3.1x ROI)',
    worst_channel: 'LinkedIn (1.2x ROI)'
  };

  res.render('layout', {
    page: 'marketing',
    title: 'Marketing — Broker Command',
    stats, campaigns, brandAssets, recruitingAssets, contentCalendar, roi
  });
});

function buildContentCalendar() {
  // 12 scheduled items across the next 4 weeks — seeded for demo consistency.
  const items = [
    { day: 3,  platform: 'FB',      title: 'Open house recap — 215 Pine' },
    { day: 5,  platform: 'IG',      title: 'Listing reel — Kingston' },
    { day: 6,  platform: 'Email',   title: 'First-time buyer drip #2' },
    { day: 9,  platform: 'LI',      title: 'Recruit post — Why Gorilla Plan B' },
    { day: 10, platform: 'Blog',    title: 'NEPA market report — April' },
    { day: 12, platform: 'FB',      title: 'Just Sold — 88 Willow' },
    { day: 14, platform: 'YouTube', title: 'Education — Agreement of Sale walkthrough' },
    { day: 17, platform: 'IG',      title: 'Agent spotlight — Naire' },
    { day: 20, platform: 'LI',      title: 'Recruit post — top producer testimonial' },
    { day: 22, platform: 'Email',   title: 'Spring buyer checklist' },
    { day: 25, platform: 'FB',      title: 'Open house — Scranton' },
    { day: 28, platform: 'Blog',    title: 'How we price in a shifting market' }
  ];

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const monthName = today.toLocaleString('en-US', { month: 'long' });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push({ empty: true });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, items: items.filter(i => i.day === d) });
  }
  return { monthName, year, cells };
}

// ─── COMPLIANCE ────────────────────────────────────────────────────────────
app.get('/compliance', requireAuth, (req, res) => {
  const statusCards = [
    { label: 'Brokerage License',  value: 'ACTIVE', sub: 'Renews Aug 2026 · 124 days',     tone: 'green' },
    { label: 'Broker License (Steve)', value: 'ACTIVE', sub: 'Renews Jun 2026 · 62 days',   tone: 'green' },
    { label: 'E&O Insurance',      value: 'ACTIVE', sub: 'Renews May 9 2026 · 23 days',     tone: 'gold' },
    { label: 'Open Compliance Flags', value: '1',   sub: '1 issue requires action',          tone: 'orange' }
  ];

  const deadlines = [
    { date: 'April 28',   title: 'PA quarterly trust account reconciliation due', urgent: false, sub: '12 days' },
    { date: 'May 9',      title: 'E&O insurance renewal',                          urgent: true,  sub: '23 days — URGENT' },
    { date: 'June 1',     title: 'Continuing education credits due (Steve, 8 hrs short)', urgent: false, sub: '46 days' },
    { date: 'June 15',    title: 'Steve broker license renewal',                   urgent: false, sub: '60 days' },
    { date: 'July 1',     title: 'Q2 commission disbursement audit',               urgent: false, sub: '76 days' },
    { date: 'August 30',  title: 'Brokerage entity license renewal',               urgent: false, sub: '136 days' },
    { date: 'October 1',  title: 'Annual RESPA audit',                             urgent: false, sub: '168 days' }
  ];

  const flags = [
    {
      id: 'flag_pine',
      property: '215 Pine Street, Kingston PA',
      type: 'Missing seller signature on Agreement of Sale',
      source: 'Transaction Command',
      daysOpen: 2,
      assigned: 'Naire Crayton',
      status: 'Awaiting agent action',
      tcLink: 'https://transaction-command-production.up.railway.app'
    }
  ];

  const docs = [
    { name: 'E&O Insurance Policy',          updated: '2025-05-10', expires: '2026-05-09' },
    { name: 'Articles of Organization',      updated: '2023-02-14', expires: null },
    { name: 'Operating Agreement',           updated: '2023-02-14', expires: null },
    { name: 'Trust Account Agreement',       updated: '2024-11-03', expires: null },
    { name: 'PA State License Certificate',  updated: '2025-06-15', expires: '2026-06-15' },
    { name: 'Federal EIN Letter',            updated: '2023-02-12', expires: null },
    { name: 'Workers Comp Policy',           updated: '2025-09-01', expires: '2026-09-01' },
    { name: 'General Liability Policy',      updated: '2025-09-01', expires: '2026-09-01' }
  ];

  res.render('layout', {
    page: 'compliance',
    title: 'Compliance & Licensing — Broker Command',
    statusCards, deadlines, flags, docs
  });
});

// ─── ABOUT (public) ────────────────────────────────────────────────────────
app.get('/about', (req, res) => {
  res.render('layout', { page: 'about', title: 'About — Broker Command' });
});

// ─── MARKETING COMMAND NOTIFY (coming soon) ───────────────────────────────
app.post('/api/notify-marketing-command', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required.' });
  mcNotifyList.push({ email: email.trim().toLowerCase(), at: new Date().toISOString() });
  res.json({ ok: true, count: mcNotifyList.length });
});

// Health
app.get('/_health', (_req, res) => res.json({ ok: true, version: APP_VERSION, deployed: LAST_DEPLOY }));

// 404
app.use((req, res) => res.status(404).render('layout', { page: 'not-found', title: 'Not Found — Broker Command' }));

// Errors
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  res.status(500).send('Server error: ' + (err.message || 'unknown'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('');
    console.log(`  Broker Command ${APP_VERSION}`);
    console.log(`  Last deploy: ${LAST_DEPLOY}`);
    console.log(`  Running on http://localhost:${PORT}`);
    console.log(`  Login:  broker / [ADMIN_PASSWORD]`);
    console.log('');
  });
}

module.exports = app;
