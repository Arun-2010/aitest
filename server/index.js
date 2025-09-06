// server/index.js
// Minimal end-to-end backend for AI-Powered Communication Assistant
// Tech: Node.js + Express. In-memory store for hackathon; swap with Mongo/Postgres later.

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// --- Utilities --------------------------------------------------------------
const POSITIVE_WORDS = ['thanks','great','good','appreciate','love','happy','resolved','working'];
const NEGATIVE_WORDS = ['issue','error','unable','down','blocked','fail','failed','charge','double','immediately','asap','critical','urgent','frustrated','angry','not working','cannot'];
const URGENT_KEYWORDS = ['urgent','immediately','asap','critical','cannot access','can\'t access','down','blocked','system is down','yesterday','since yesterday','reset link','charged twice'];

function scoreSentiment(text = '') {
  const t = text.toLowerCase();
  let score = 0;
  POSITIVE_WORDS.forEach(w => { if (t.includes(w)) score += 1; });
  NEGATIVE_WORDS.forEach(w => { if (t.includes(w)) score -= 1; });
  const label = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  return { score, label };
}

function isUrgent(text = '') {
  const t = text.toLowerCase();
  return URGENT_KEYWORDS.some(k => t.includes(k));
}

function extractInfo(text = '') {
  const phones = Array.from(new Set((text.match(/\b\+?\d[\d\s\-]{6,}\d\b/g) || []).map(s => s.trim())));
  const emails = Array.from(new Set((text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).map(s => s.toLowerCase())));
  const keywords = ['billing','login','verification','password','reset','integration','api','refund','downtime','subscription','pricing'];
  const lower = text.toLowerCase();
  const tags = keywords.filter(k => lower.includes(k));
  return { phones, emails, tags };
}

function summarize(text = '') {
  // super-light heuristic "summary"
  const firstTwo = text.replace(/\s+/g, ' ').trim().split('. ').slice(0, 2).join('. ');
  return firstTwo || text.slice(0, 160);
}

// Simple pseudo-RAG: match against tiny knowledge base by keyword overlap
const KB = [
  { id: 'kb_pricing', topic: 'pricing', content: 'Our pricing has Free, Pro, and Enterprise tiers. Pro is $49/month with priority support.' },
  { id: 'kb_refund', topic: 'refund', content: 'Refunds are processed within 5–7 business days after verification of the transaction.' },
  { id: 'kb_reset', topic: 'password reset', content: 'Use the reset link from the login page. If it expires, we can trigger a new link that is valid for 30 minutes.' },
  { id: 'kb_api', topic: 'api integration', content: 'We support REST webhooks and OAuth2. Rate limit is 1000 requests/min on Pro.' },
  { id: 'kb_verification', topic: 'email verification', content: 'Verification emails arrive within 2–3 minutes. Check spam; we can also verify manually if needed.' },
];

function retrieveKB(text='') {
  const t = text.toLowerCase();
  // rank by number of topic keywords in text
  const ranked = KB.map(k => ({
    k, score: k.topic.split(/\s+/).filter(w => t.includes(w)).length + (t.includes(k.topic.split(' ')[0]) ? 1 : 0)
  })).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score ? ranked[0].k : null;
}

function draftReply(email) {
  const { sender, subject, body } = email;
  const { label } = scoreSentiment(body);
  const urgent = isUrgent(body);
  const kb = retrieveKB(body);
  const empathy = label === 'negative' || urgent
    ? "I\'m really sorry for the trouble you\'re facing—thanks for flagging this."
    : 'Happy to help—thanks for reaching out!';
  const kbLine = kb ? `\n\nHere\'s some information that might help right away: ${kb.content}` : '';
  const nextSteps = urgent
    ? 'I\'ve prioritized your case and started an investigation. We will update you shortly.'
    : 'I\'ve logged your request with our support team. We\'ll keep you posted.';

  return (
`Hi ${sender.split('@')[0]},

${empathy}

Regarding your message: "${subject}"—here\'s a quick summary of what I understood: ${summarize(body)}.

${nextSteps}${kbLine}

If you can share any additional details (screenshots, exact timestamps, last 4 digits of the transaction), it will help us resolve this faster.

Best regards,\nSupport Assistant`);
}

// --- Seed Data (you can replace with CSV/IMAP later) -----------------------
let emails = [
  { id: 1, sender: 'alice@example.com', subject: 'Help required with account verification', body: 'I am facing issues with verifying my account. The verification email never arrived. Can you assist? It\'s urgent.', sent_date: new Date(Date.now()-1000*60*30).toISOString() },
  { id: 2, sender: 'bob@customer.io', subject: 'Immediate support needed for billing error', body: 'There is a billing error where I was charged twice. This needs immediate correction.', sent_date: new Date(Date.now()-1000*60*120).toISOString() },
  { id: 3, sender: 'carol@company.org', subject: 'Question: integration with API', body: 'Do you support integration with third-party APIs? Specifically, I\'m looking for CRM integration options.', sent_date: new Date(Date.now()-1000*60*240).toISOString() },
  { id: 4, sender: 'dave@startup.dev', subject: 'Critical help needed for downtime', body: 'Our servers are down, and we need immediate support. This is highly critical.', sent_date: new Date(Date.now()-1000*60*10).toISOString() },
];

// Augment with analysis
function analyzeEmail(e){
  const sentiment = scoreSentiment(e.body);
  const urgent = isUrgent(e.body) || sentiment.label === 'negative' && /down|blocked|unable|failed|error/.test(e.body.toLowerCase());
  const info = extractInfo(e.body);
  const draft = draftReply(e);
  return { ...e, sentiment, priority: urgent ? 'urgent' : 'normal', info, draft, status: 'pending' };
}

let analyzed = emails.map(analyzeEmail);

// --- API Endpoints ----------------------------------------------------------
app.get('/api/emails', (req,res)=>{
  // optional subject filter by query
  const q = (req.query.q || '').toString().toLowerCase();
  let out = analyzed.filter(e => /support|query|request|help|urgent|issue|error/i.test(e.subject));
  if(q){ out = out.filter(e => `${e.subject} ${e.body}`.toLowerCase().includes(q)); }
  out.sort((a,b)=> (a.priority===b.priority?0:a.priority==='urgent'?-1:1) || new Date(b.sent_date)-new Date(a.sent_date));
  res.json(out);
});

app.post('/api/respond/:id', (req,res)=>{
  const id = Number(req.params.id);
  const { reply } = req.body;
  const idx = analyzed.findIndex(e=>e.id===id);
  if(idx<0) return res.status(404).json({ error: 'not found' });
  analyzed[idx].reply = reply || analyzed[idx].draft;
  analyzed[idx].status = 'resolved';
  analyzed[idx].resolved_at = new Date().toISOString();
  res.json({ ok: true, item: analyzed[idx] });
});

app.get('/api/stats', (req,res)=>{
  const now = Date.now();
  const last24 = analyzed.filter(e => now - new Date(e.sent_date).getTime() <= 24*3600*1000);
  const total24 = last24.length;
  const resolved = analyzed.filter(e=>e.status==='resolved').length;
  const pending = analyzed.filter(e=>e.status!=='resolved').length;
  const bySentiment = ['positive','neutral','negative'].reduce((acc,k)=>{acc[k]=analyzed.filter(e=>e.sentiment.label===k).length;return acc;},{})
  const byPriority = ['urgent','normal'].reduce((acc,k)=>{acc[k]=analyzed.filter(e=>e.priority===k).length;return acc;},{})
  res.json({ total24, resolved, pending, bySentiment, byPriority });
});

app.post('/api/ingest', (req,res)=>{
  // Accepts an array of {sender,subject,body,sent_date}
  const items = Array.isArray(req.body) ? req.body : [];
  const startId = analyzed.reduce((m,e)=>Math.max(m,e.id),0) + 1;
  const expanded = items.map((e,i)=>({ id: startId+i, ...e }));
  analyzed.push(...expanded.map(analyzeEmail));
  res.json({ added: expanded.length });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log(`AI Support Assistant API running on http://localhost:${PORT}`));

// --- How to run -------------------------------------------------------------
// 1) mkdir server && cd server && npm init -y
// 2) npm i express cors body-parser
// 3) Save this file as index.js inside server/
// 4) node index.js
// Your API will be available at http://localhost:4000/api/*
