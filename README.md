# Broker Command

The Brokerage Executive Operating System. Built by Projects with a Purpose LLC.

Five pages: Executive Dashboard · Recruiting · Marketing · Compliance · About.

## Run locally

```
npm install
node index.js
```

Visit `http://localhost:3007`.

Login: `broker` / `gorilla2026`.

## Routes

| Route | Purpose |
| --- | --- |
| `/login` | Single broker admin login |
| `/dashboard` | Executive view — MRR, productivity, health score, attention queue + PwP sidebar (Marketing Command Coming Soon with Notify Me) |
| `/recruiting` | Kanban pipeline w/ 8 demo prospects, Add Prospect modal, move/lose/convert actions |
| `/marketing` | Tabs: Active Campaigns, Brand Assets, Recruiting Marketing, Content Calendar |
| `/compliance` | Tabs: Regulatory Calendar, Open Flags, Insurance & Entity Docs |
| `/about` | Public marketing page w/ opening line + platform positioning |

## PwP cross-sell sidebar

The dashboard right-rail shows every PwP product with an [Open] link. Marketing Command is marked Coming Q2 2026 with a gold-border card and a Notify Me modal that captures email.

## Version + deploy timestamp

Top of `index.js`:
```
const APP_VERSION = 'v1.0';
const LAST_DEPLOY = 'April 16, 2026 11:27 PM EST';
```

Per PwP standard: bump both **before** every Railway push.
