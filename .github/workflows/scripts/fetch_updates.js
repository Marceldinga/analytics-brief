// Build updates.json for the site
// Pulls from a few stable RSS sources; easy to extend with jobs, certs, etc.

import Parser from 'rss-parser';
import { formatISO, subDays } from 'date-fns';
import fs from 'fs';

const parser = new Parser();

// === Sources ===
const FEEDS = [
  // Industry / tools
  'https://towardsdatascience.com/feed',        // data/ML articles (curate later)
  'https://aws.amazon.com/blogs/machine-learning/feed/',
  'https://azurecomcdn.azureedge.net/en-us/blog/topics/ai-machine-learning/feed/',
  'https://powerbi.microsoft.com/en-us/blog/feed/',
  'https://blog.scikit-learn.org/feed.xml',
  // Certifications / learn
  'https://learn.microsoft.com/api/learnrss',   // MS Learn (broad)
];

// Helper: normalize one item to site schema
function toCard(category, it) {
  const date = it.isoDate || it.pubDate || new Date().toISOString();
  return {
    category,
    title: (it.title || 'Update').trim(),
    source: new URL(it.link || 'https://example.com').hostname.replace('www.',''),
    date: date.slice(0,10),
    summary: (it.contentSnippet || it.content || '').replace(/\s+/g,' ').slice(0,220) + '…',
    link: it.link || '#'
  };
}

// Load previous updates to preserve history (if present)
let previous = [];
if (fs.existsSync('updates.json')) {
  try { previous = JSON.parse(fs.readFileSync('updates.json','utf-8')); } catch {}
}

const cutoff = subDays(new Date(), 21); // last ~3 weeks
const NOW_ISO = formatISO(new Date(), { representation:'date' });

const out = [];

for (const url of FEEDS) {
  try {
    const feed = await parser.parseURL(url);
    for (const item of (feed.items || []).slice(0, 8)) {
      const d = new Date(item.isoDate || item.pubDate || Date.now());
      if (d >= cutoff) out.push(toCard('News', item));
    }
  } catch (e) {
    console.log('Feed error:', url, e.message);
  }
}

// Example: add a few standing “Career/Certs/Tools” guidance cards (rotate weekly if desired)
out.push(
  { category:'Career', title:'Hiring trend: analytics + LLM orchestration', source:'curated', date: NOW_ISO,
    summary:'Rising demand for analysts who can wire LLMs to dashboards with governance and latency targets.', link:'#' },
  { category:'Certifications', title:'DP-100 focus areas to study next', source:'curated', date: NOW_ISO,
    summary:'MLOps, responsible AI, prompt/flow orchestration, and experiment tracking remain high-value.', link:'#' }
);

// TODO: Jobs (optional)
// You can add your own curated jobs here or later wire to APIs.
// out.push({ category:'Jobs', title:'Data Analyst — DoD program (Secret → TS/SCI)', source:'DMV contractor', date: NOW_ISO,
//   summary:'SQL, Python, Power BI; telemetry triage; hybrid Arlington, VA.', link:'#',
//   bullets:['Python + SQL pipelines with validation','Power BI exec/SOC views <10s','XGBoost + autoencoder anomaly scoring'] });

/* ---- Merge + Dedupe (keep newest first) ---- */
const key = x => `${x.category}|${x.title}|${x.link}`;
const merged = [...out, ...previous].reduce((acc, item) => {
  if (!acc.map.has(key(item))) { acc.map.set(key(item), true); acc.arr.push(item); }
  return acc;
}, {arr:[], map:new Map()}).arr;

// Sort newest first
merged.sort((a,b)=> (b.date||'').localeCompare(a.date||''));

fs.writeFileSync('updates.json', JSON.stringify(merged.slice(0, 120), null, 2));
console.log(`Wrote ${Math.min(merged.length,120)} items to updates.json`);
