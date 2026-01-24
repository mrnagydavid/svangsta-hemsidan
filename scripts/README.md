# Build Scripts

This directory contains build-time scripts that are **NOT** part of the website's runtime dependencies.

## Purpose

These scripts run during the GitHub Actions workflow to fetch and process external data before the site is built.

## Structure

- `package.json` - Dependencies for build scripts only (separate from main site)
- `fetch-events.js` - Fetches events from multiple sources and updates `src/events.json`

## Local Development

To test the event fetching script locally:

```bash
cd scripts
npm install
node fetch-events.js
```

This will update `src/events.json` with the latest events from all three sources.

## Event Sources

### Automated Sources (via this script)
1. **Swedish Church API** - Asarum-Ringamåla församling events
2. **Svängsta Trädgårdsförening** - Garden society events (web scraping)

### Manual Sources (curated separately)
3. **PRO Svängsta-Asarum** - Manually curated using LLM-based workflow (see `.claude/update-pro-events.md`)

## Output Format

The script updates `src/events.json` (a simple array) with events from all sources:

```json
[
  {
    "id": "unique-id",
    "title": "Event title",
    "startDate": "ISO date string",
    "endDate": "ISO date string",
    "location": "Location name",
    "description": "Event description",
    "organizer": "Organizer name",
    "organizerLink": "URL to organizer",
    "link": "URL to event details",
    "forMembersOnly": false
  }
]
```

**Event ID prefixes:**
- `church-*` - Swedish Church events (fully automated)
- `garden-*` - Garden society events (fully automated)
- `pro-*` - PRO events (manually curated)
  - Recurring events use format: `pro-[id]-week[n]` (e.g., `pro-199372-week1`)

## Automation

The script runs automatically via GitHub Actions:
- **Schedule**: Daily at 6 AM UTC
- **Workflow**: `.github/workflows/fetch-events.yml`
- **Manual trigger**: Available via GitHub Actions UI

## How It Works

### Church Events
- Fetches from Swedish Church API using subscription key
- Includes full event details (title, description, dates, location)
- Automatically filters to show only future events

### Garden Society Events
- Scrapes the website using cheerio
- Parses HTML to extract event information
- Attempts to parse Swedish date formats into ISO format

### PRO Events (Manual)
PRO events are **not automated** by this script. They are manually curated using an LLM-based workflow that:
- Intelligently parses event descriptions
- Detects and expands recurring events
- Properly handles member restrictions
- See `.claude/update-pro-events.md` for the manual workflow

The automation script preserves all existing PRO events while updating church and garden events.

## Dependencies

- `cheerio` - HTML parsing for garden society events
