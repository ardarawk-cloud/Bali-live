import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import WebSocket from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const TIKFINITY_WS = process.env.TIKFINITY_WS || "ws://127.0.0.1:21213/";
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const COOLDOWN_MS = Number(process.env.USER_COOLDOWN_SECONDS || 8) * 1000;
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
  expiresAt:0,
  receivedAt:0
};

const userCooldown = new Map();
const seenMessages = new Map();
const sseClients = new Set();
const motionSseClients = new Set();

let motionState = {
  seq:0,
  track:{ title:"", artist:"", updatedAt:0 },
  station:{ active:false, text:"", updatedAt:0 },
  alert:null
};

let queue = [];
let working = false;
let tikfinityConnected = false;
let reconnectTimer = null;
let lastTikfinityEventAt = 0;
let lastChatAt = 0;
let lastCommandAt = 0;

function publicMotionState() {
  return {
    ...motionState,
    tikfinityConnected,
    now:Date.now()
  };
}

function broadcastMotion() {
  const payload = `data: ${JSON.stringify(publicMotionState())}\n\n`;
  for (const res of motionSseClients) {
    try { res.write(payload); } catch {}
  }
}

function setTrackMotion(title="", artist="") {
  motionState = {
    ...motionState,
    seq:motionState.seq+1,
    track:{
      title:String(title || "").trim().slice(0,120),
      artist:String(artist || "").trim().slice(0,120),
      updatedAt:Date.now()
    }
  };
  broadcastMotion();
}

function setStationMotion(active=false, text="") {
  motionState = {
    ...motionState,
    seq:motionState.seq+1,
    station:{
      active:Boolean(active),
      text:String(text || "").trim().slice(0,220),
      updatedAt:Date.now()
    }
  };
  broadcastMotion();
}

function pushMotionAlert(type, data={}) {
  motionState = {
    ...motionState,
    seq:motionState.seq+1,
    alert:{
      id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type:String(type || "event"),
      username:String(data.username || "viewer").slice(0,80),
      nickname:String(data.nickname || data.username || "Viewer").slice(0,80),
      detail:String(data.detail || "").slice(0,140),
      createdAt:Date.now(),
      expiresAt:Date.now()+7500
    }
  };
  broadcastMotion();
}

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
  const u = data.user || data.author || data.sender || {};
  return {
    uniqueId:
      data.uniqueId ||
      data.userUniqueId ||
      data.username ||
      u.uniqueId ||
      u.displayId ||
      u.username ||
      "viewer",
    nickname:
      data.nickname ||
      data.displayName ||
      u.nickname ||
      u.displayName ||
      data.uniqueId ||
      u.uniqueId ||
      "Viewer"
  };
}

function getComment(data={}) {
  return String(
    data.comment ??
    data.commentText ??
    data.text ??
    data.message ??
    data.content ??
    data.payload?.comment ??
    ""
  ).trim();
}

function parseCommand(comment="") {
  const m = String(comment).trim().match(/^!(curhat|tanya|roast|quote|jodoh|ai)\s+(.+)/i);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const cmd = raw === "ai" ? "tanya" : raw;
  return { command:cmd, displayCommand:raw, text:maskPrivateInfo(m[2]) };
}

function systemPrompt(command) {
  const base = [
    "You are BALI AI, a concise AI co-host for a public TikTok LIVE from Bali.",
    "Reply in the user's language; default to casual Indonesian.",
    "Keep the response suitable for a public livestream and under 45 words.",
    "Answer immediately; no preamble.",
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

function publicState() {
  return {
    ...state,
    active:state.active && Date.now() < state.expiresAt,
    tikfinityConnected,
    aiConfigured:Boolean(apiKey),
    model:MODEL,
    queueLength:queue.length,
    lastTikfinityEventAt,
    lastChatAt,
    lastCommandAt
  };
}

function broadcastState() {
  const payload = `data: ${JSON.stringify(publicState())}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch {}
  }
}

function setState(next) {
  state = { ...state, ...next };
  broadcastState();
}

function cleanupSeen() {
  const cutoff = Date.now() - 120000;
  for (const [key, ts] of seenMessages) {
    if (ts < cutoff) seenMessages.delete(key);
  }
}

function eventId(data={}) {
  return String(
    data.messageUuid ||
    data.msgId ||
    data.messageId ||
    data.id ||
    ""
  );
}

async function runAI(job) {
  if (!openai) {
    setState({
      active:true,
      status:"error",
      command:job.displayCommand,
      username:job.user.uniqueId,
      nickname:job.user.nickname,
      question:job.text,
      answer:"BALI AI belum tersambung ke API key.",
      createdAt:Date.now(),
      expiresAt:Date.now()+12000
    });
    return;
  }

  try {
    const startedAt = Date.now();
    const response = await openai.responses.create({
      model:MODEL,
      reasoning:{ effort:"none" },
      instructions:systemPrompt(job.command),
      input:`Viewer @${job.user.uniqueId}: ${job.text}`,
      max_output_tokens:120,
      store:false
    });

    const answer = String(response.output_text || "").trim().slice(0, 500);
    setState({
      active:true,
      status:"answer",
      command:job.displayCommand,
      username:job.user.uniqueId,
      nickname:job.user.nickname,
      question:job.text,
      answer:answer || "Aku belum punya jawaban yang pas buat itu.",
      createdAt:Date.now(),
      expiresAt:Date.now()+22000,
      aiLatencyMs:Date.now()-startedAt
    });
  } catch (err) {
    console.error("OpenAI error:", err?.status || "", err?.message || err);
    setState({
      active:true,
      status:"error",
      command:job.displayCommand,
      username:job.user.uniqueId,
      nickname:job.user.nickname,
      question:job.text,
      answer:"BALI AI gagal jawab. Coba kirim lagi sebentar.",
      createdAt:Date.now(),
      expiresAt:Date.now()+10000
    });
  }
}

async function processQueue() {
  if (working) return;
  working = true;
  while (queue.length) {
    const job = queue.shift();
    await runAI(job);
  }
  working = false;
}

function enqueue(job) {
  if (queue.length >= 6) queue.shift();
  queue.push(job);
  processQueue();
}

function handleChat(data={}) {
  lastChatAt = Date.now();
  const comment = getComment(data);
  const parsed = parseCommand(comment);
  if (!parsed || !parsed.text) return;

  const id = eventId(data);
  if (id && seenMessages.has(id)) return;
  if (id) {
    seenMessages.set(id, Date.now());
    cleanupSeen();
  }

  const user = getUser(data);
  const userKey = user.uniqueId || user.nickname;
  const last = userCooldown.get(userKey) || 0;
  const now = Date.now();

  if (now - last < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    console.log(`Cooldown @${userKey}: ${wait}s`);
    return;
  }

  userCooldown.set(userKey, now);
  lastCommandAt = now;

  // Show acknowledgement immediately, before the AI request starts.
  setState({
    active:true,
    status:"thinking",
    command:parsed.displayCommand,
    username:user.uniqueId,
    nickname:user.nickname,
    question:parsed.text,
    answer:"",
    receivedAt:now,
    createdAt:now,
    expiresAt:now+30000
  });

  console.log(`AI request @${user.uniqueId}: !${parsed.displayCommand} ${parsed.text}`);
  enqueue({ ...parsed, user });
}

function handleMotionTikfinityEvent(eventName, data={}) {
  const user = getUser(data);
  const lower = String(eventName || "").toLowerCase();

  if (lower.includes("gift")) {
    const giftName =
      data.giftName ||
      data.gift?.name ||
      data.gift?.giftName ||
      data.extendedGiftInfo?.name ||
      "gift";
    const repeat =
      Number(data.repeatCount || data.repeat_count || data.combo || data.repeatEnd || 1) || 1;
    pushMotionAlert("gift", {
      ...user,
      detail:`${giftName}${repeat > 1 ? ` ×${repeat}` : ""}`
    });
    return;
  }

  if (lower.includes("follow")) {
    pushMotionAlert("follow", { ...user, detail:"FOLLOWED THE RADIO" });
    return;
  }

  if (lower.includes("share")) {
    pushMotionAlert("share", { ...user, detail:"SHARED THE LIVE" });
    return;
  }

  if (
    lower.includes("join") ||
    lower.includes("member") ||
    lower.includes("enter") ||
    lower.includes("viewer")
  ) {
    pushMotionAlert("join", { ...user, detail:"JOINED BALI LIVE RADIO" });
  }
}

function handleTikfinityMessage(raw) {
  try {
    const msg = JSON.parse(raw.toString());
    if (!msg || typeof msg !== "object") return;

    lastTikfinityEventAt = Date.now();
    const eventName = String(msg.event || msg.type || msg.eventType || "").toLowerCase();
    const data = msg.data || msg.payload || msg;

    if (eventName === "chat" || eventName === "comment" || eventName.includes("chat")) {
      handleChat(data);
    }

    handleMotionTikfinityEvent(eventName, data);
  } catch (err) {
    console.error("TikFinity message parse error:", err?.message || err);
  }
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectTikFinity, 1200);
}

function connectTikFinity() {
  console.log(`Connecting TikFinity Event API: ${TIKFINITY_WS}`);
  const ws = new WebSocket(TIKFINITY_WS);

  ws.on("open", () => {
    tikfinityConnected = true;
    console.log("TikFinity connected.");
    broadcastState();
  });

  ws.on("message", handleTikfinityMessage);

  ws.on("close", () => {
    tikfinityConnected = false;
    console.log("TikFinity disconnected. Reconnecting...");
    broadcastState();
    scheduleReconnect();
  });

  ws.on("error", err => {
    tikfinityConnected = false;
    console.log("TikFinity connection error:", err?.message || err);
    broadcastState();
    try { ws.close(); } catch {}
  });
}

app.get("/api/motion", (_req,res) => {
  res.set("Cache-Control","no-store");
  res.json(publicMotionState());
});

app.get("/api/motion/events", (req,res) => {
  res.set({
    "Content-Type":"text/event-stream",
    "Cache-Control":"no-cache, no-transform",
    "Connection":"keep-alive",
    "X-Accel-Buffering":"no"
  });
  res.flushHeaders?.();
  motionSseClients.add(res);
  res.write(`data: ${JSON.stringify(publicMotionState())}\n\n`);

  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch {}
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    motionSseClients.delete(res);
  });
});

app.post("/api/motion/track", (req,res) => {
  setTrackMotion(req.body?.title, req.body?.artist);
  res.json({ ok:true, motion:publicMotionState() });
});

app.post("/api/motion/station", (req,res) => {
  setStationMotion(req.body?.active, req.body?.text);
  res.json({ ok:true, motion:publicMotionState() });
});

app.post("/api/motion/test-alert", (req,res) => {
  pushMotionAlert(req.body?.type || "follow", {
    username:req.body?.username || "localtest",
    nickname:req.body?.nickname || "Local Test",
    detail:req.body?.detail || "MOTION PACK TEST"
  });
  res.json({ ok:true, motion:publicMotionState() });
});

app.get("/api/state", (_req,res) => {
  res.set("Cache-Control","no-store");
  res.json(publicState());
});

app.get("/api/events", (req,res) => {
  res.set({
    "Content-Type":"text/event-stream",
    "Cache-Control":"no-cache, no-transform",
    "Connection":"keep-alive",
    "X-Accel-Buffering":"no"
  });
  res.flushHeaders?.();
  sseClients.add(res);
  res.write(`data: ${JSON.stringify(publicState())}\n\n`);

  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch {}
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

app.post("/api/test", (req,res) => {
  const text = String(req.body?.text || "!ai tes koneksi").trim();
  handleChat({
    comment:text,
    uniqueId:"localtest",
    nickname:"Local Test",
    messageUuid:`local-${Date.now()}`
  });
  res.json({ ok:true, state:publicState() });
});

app.get("/health", (_req,res) => {
  res.set("Cache-Control","no-store");
  res.json({
    service:"BALI LIVE AI",
    status:"online",
    tikfinityConnected,
    aiConfigured:Boolean(apiKey),
    model:MODEL,
    queueLength:queue.length,
    lastTikfinityEventAt,
    lastChatAt,
    lastCommandAt
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("BALI LIVE AI ONLINE");
  console.log(`AI      : http://localhost:${PORT}/overlay.html`);
  console.log(`Motion  : http://localhost:${PORT}/motion.html`);
  console.log(`Health : http://localhost:${PORT}/health`);
  console.log("");
  connectTikFinity();
});
