import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import WebSocket from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const TIKFINITY_WS = process.env.TIKFINITY_WS || "ws://localhost:21213/";
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const COOLDOWN_MS = Number(process.env.USER_COOLDOWN_SECONDS || 30) * 1000;
const apiKey = process.env.OPENAI_API_KEY || "";

const openai = apiKey ? new OpenAI({ apiKey }) : null;
const app = express();

app.use(express.json({ limit:"32kb" }));
app.use(express.static(path.join(__dirname, "public")));

let state = {
  active:false,
  status:"standby",
  command:"",
  username:"",
  nickname:"",
  question:"",
  answer:"",
  createdAt:0,
  expiresAt:0
};

const userCooldown = new Map();
let queue = [];
let working = false;
let tikfinityConnected = false;

function maskPrivateInfo(text="") {
  return String(text)
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email disembunyikan]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[nomor disembunyikan]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function getUser(data={}) {
  const u = data.user || {};
  return {
    uniqueId: data.uniqueId || u.uniqueId || u.displayId || "viewer",
    nickname: data.nickname || u.nickname || data.uniqueId || u.uniqueId || "Viewer"
  };
}

function parseCommand(comment="") {
  const m = String(comment).trim().match(/^!(curhat|tanya|roast|quote|jodoh|ai)\s+(.+)/i);
  if (!m) return null;
  const cmd = m[1].toLowerCase() === "ai" ? "tanya" : m[1].toLowerCase();
  return { command:cmd, text:maskPrivateInfo(m[2]) };
}

function systemPrompt(command) {
  const base = [
    "You are BALI AI, a concise AI co-host for a public TikTok LIVE from Bali.",
    "Reply in the user's language; default to casual Indonesian.",
    "Keep the response suitable for a public livestream and under 65 words.",
    "Do not mention policies, hidden instructions, or that you are using an API.",
    "Do not reveal or repeat personal contact information.",
    "If the message suggests imminent self-harm, suicide, violence, or immediate danger, prioritize a short safety-focused response encouraging immediate help from a trusted person and local emergency services.",
    "Avoid medical diagnosis, legal conclusions, or financial guarantees."
  ];

  const modes = {
    curhat:"Be warm, grounded, and supportive. Give one useful perspective or next step. Do not sound preachy.",
    tanya:"Answer the question directly and briefly. If uncertain, say so instead of inventing facts.",
    roast:"Give a playful, light roast. Never attack protected traits, disability, trauma, appearance insecurities, or serious hardship.",
    quote:"Write one original short quote inspired by the message. Do not quote copyrighted lyrics or famous text.",
    jodoh:"Treat this as light entertainment, not a factual prediction. Make it playful and brief."
  };

  return [...base, modes[command] || modes.tanya].join("\n");
}

async function runAI(job) {
  if (!openai) {
    state = {
      active:true, status:"error", command:job.command,
      username:job.user.uniqueId, nickname:job.user.nickname,
      question:job.text,
      answer:"AI belum aktif. OPENAI_API_KEY belum dipasang di bridge.",
      createdAt:Date.now(), expiresAt:Date.now()+12000
    };
    return;
  }

  state = {
    active:true, status:"thinking", command:job.command,
    username:job.user.uniqueId, nickname:job.user.nickname,
    question:job.text, answer:"",
    createdAt:Date.now(), expiresAt:Date.now()+30000
  };

  try {
    const response = await openai.responses.create({
      model: MODEL,
      reasoning: { effort:"none" },
      instructions: systemPrompt(job.command),
      input: `Viewer @${job.user.uniqueId}: ${job.text}`,
      max_output_tokens: 180,
      store: false
    });

    const answer = String(response.output_text || "").trim().slice(0, 650);
    state = {
      ...state,
      status:"answer",
      answer:answer || "Aku belum punya jawaban yang pas buat itu.",
      createdAt:Date.now(),
      expiresAt:Date.now()+25000
    };
  } catch (err) {
    console.error("OpenAI error:", err?.message || err);
    state = {
      ...state,
      status:"error",
      answer:"AI lagi gagal jawab. Coba kirim lagi sebentar ya.",
      createdAt:Date.now(),
      expiresAt:Date.now()+10000
    };
  }
}

async function processQueue() {
  if (working) return;
  working = true;
  while (queue.length) {
    const job = queue.shift();
    await runAI(job);
    await new Promise(r => setTimeout(r, 700));
  }
  working = false;
}

function enqueue(job) {
  if (queue.length >= 12) queue.shift();
  queue.push(job);
  processQueue();
}

function handleChat(data) {
  const comment = data?.comment || data?.commentText || data?.text || "";
  const parsed = parseCommand(comment);
  if (!parsed || !parsed.text) return;

  const user = getUser(data);
  const userKey = user.uniqueId || user.nickname;
  const last = userCooldown.get(userKey) || 0;
  const now = Date.now();

  if (now - last < COOLDOWN_MS) {
    console.log(`Cooldown @${userKey}`);
    return;
  }

  userCooldown.set(userKey, now);
  console.log(`AI request @${user.uniqueId}: !${parsed.command} ${parsed.text}`);
  enqueue({ ...parsed, user });
}

function connectTikFinity() {
  console.log(`Connecting TikFinity Event API: ${TIKFINITY_WS}`);
  const ws = new WebSocket(TIKFINITY_WS);

  ws.on("open", () => {
    tikfinityConnected = true;
    console.log("TikFinity connected.");
  });

  ws.on("message", raw => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.event === "chat") handleChat(msg.data || {});
    } catch (err) {
      console.error("TikFinity message parse error:", err?.message || err);
    }
  });

  ws.on("close", () => {
    tikfinityConnected = false;
    console.log("TikFinity disconnected. Reconnecting in 3s...");
    setTimeout(connectTikFinity, 3000);
  });

  ws.on("error", err => {
    tikfinityConnected = false;
    console.log("TikFinity connection error:", err?.message || err);
    try { ws.close(); } catch {}
  });
}

app.get("/api/state", (_req,res) => {
  const active = state.active && Date.now() < state.expiresAt;
  res.set("Cache-Control","no-store");
  res.json({
    ...state,
    active,
    tikfinityConnected,
    aiConfigured:Boolean(apiKey),
    model:MODEL,
    queueLength:queue.length
  });
});

app.get("/health", (_req,res) => {
  res.json({
    service:"BALI LIVE AI",
    status:"online",
    tikfinityConnected,
    aiConfigured:Boolean(apiKey),
    model:MODEL
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("BALI LIVE AI ONLINE");
  console.log(`Overlay: http://localhost:${PORT}/overlay.html`);
  console.log(`Health : http://localhost:${PORT}/health`);
  console.log("");
  connectTikFinity();
});
