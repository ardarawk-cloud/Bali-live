(() => {
  const BALI_TZ = "Asia/Makassar";
  const CURRENT_VERSION = "1.7.0";

  const titleEl = document.getElementById("daypartTitle");
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date");
  const promptEl = document.getElementById("prompt");
  const modeLabelEl = document.getElementById("modeLabel");

  const aiCard = document.getElementById("aiLiveCard");
  const aiCommand = document.getElementById("aiLiveCommand");
  const aiViewer = document.getElementById("aiLiveViewer");
  const aiQuestion = document.getElementById("aiLiveQuestion");
  const aiThinking = document.getElementById("aiLiveThinking");
  const aiAnswer = document.getElementById("aiLiveAnswer");

  const periods = [
    { start:0, end:299, cls:"theme-midnight", title:"MIDNIGHT", mode:"MIDNIGHT • MUSIC • BALI" },
    { start:300, end:659, cls:"theme-morning", title:"MORNING", mode:"MORNING • MUSIC • BALI" },
    { start:660, end:959, cls:"theme-day", title:"DAY", mode:"DAY • MUSIC • TROPICAL" },
    { start:960, end:1109, cls:"theme-golden", title:"GOLDEN HOUR", mode:"GOLDEN HOUR • MUSIC • BALI" },
    { start:1110, end:1439, cls:"theme-night", title:"NIGHT", mode:"NIGHT • MUSIC • BALI" }
  ];

  const prompts = [
    "FROM BALI TO THE WORLD — 24/7",
    "REQUEST SONG: !play SONG - ARTIST",
    "ASK BALI AI: !tanya PERTANYAANMU",
    "CURHAT KE AI: !curhat PESANMU",
    "FUN MODE: !roast • !quote • !jodoh",
    "DROP YOUR CITY IN CHAT"
  ];

  // TikTok LIVE Studio's embedded browser may not ship full IANA timezone data.
  // Calculate WITA directly as UTC+8 so the live clock works reliably everywhere.
  function baliParts() {
    const now = new Date();
    const bali = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const pad = n => String(n).padStart(2, "0");

    return {
      year: String(bali.getUTCFullYear()),
      month: pad(bali.getUTCMonth() + 1),
      day: pad(bali.getUTCDate()),
      hour: pad(bali.getUTCHours()),
      minute: pad(bali.getUTCMinutes()),
      second: pad(bali.getUTCSeconds()),
      weekday: bali.getUTCDay()
    };
  }

  function baliDateLabel(p) {
    const weekdays = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
    const months = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
    return `${weekdays[p.weekday]} ${p.day} ${months[Number(p.month) - 1]} ${p.year}`;
  }

  function updateTimeAndTheme() {
    const p = baliParts();
    const mins = Number(p.hour) * 60 + Number(p.minute);
    const period = periods.find(x => mins >= x.start && mins <= x.end) || periods[4];

    document.body.classList.remove("theme-morning","theme-day","theme-golden","theme-night","theme-midnight");
    document.body.classList.add(period.cls);
    titleEl.textContent = period.title;
    modeLabelEl.textContent = period.mode;

    clockEl.textContent = `${p.hour}:${p.minute}:${p.second}`;
    dateEl.textContent = baliDateLabel(p);
  }

  function buildEqualizer() {
    const eq = document.getElementById("equalizer");
    const bars = [];

    for (let i=0; i<24; i++) {
      const bar = document.createElement("span");
      bar.className = "bar";
      bar.style.height = `${24 + Math.random()*58}px`;
      bar.style.animationDuration = `${0.35 + Math.random()*0.8}s`;
      bar.style.animationDelay = `${-Math.random()}s`;
      eq.appendChild(bar);
      bars.push(bar);
    }

    setInterval(() => {
      bars.forEach((bar, i) => {
        const wave = Math.sin((Date.now() / 220) + i * 0.68);
        const jitter = Math.random() * 28;
        bar.style.height = `${18 + ((wave + 1) * 17) + jitter}px`;
      });
    }, 260);
  }

  function buildRain() {
    const rain = document.getElementById("rain");
    for (let i=0; i<52; i++) {
      const drop = document.createElement("span");
      drop.className = "drop";
      drop.style.left = `${Math.random()*100}%`;
      drop.style.animationDuration = `${1.05 + Math.random()*1.9}s`;
      drop.style.animationDelay = `${-Math.random()*3}s`;
      drop.style.opacity = `${0.1 + Math.random()*0.45}`;
      rain.appendChild(drop);
    }
  }

  let promptIndex = 0;
  function rotatePrompt() {
    promptIndex = (promptIndex + 1) % prompts.length;
    promptEl.textContent = prompts[promptIndex];
  }

  function renderAI(s) {
    if (!aiCard) return;
    if (!s || !s.active) {
      aiCard.classList.add("hidden");
      return;
    }

    aiCommand.textContent = "!" + (s.command || "ai");
    aiViewer.textContent = "@" + (s.username || s.nickname || "viewer");
    aiQuestion.textContent = s.question || "";

    const thinking = s.status === "thinking";
    aiThinking.style.display = thinking ? "block" : "none";
    aiAnswer.style.display = thinking ? "none" : "block";
    aiAnswer.textContent = s.answer || "";
    aiCard.classList.remove("hidden");
  }

  async function connectCloudAI() {
    try {
      const health = await fetch("/health?t="+Date.now(), { cache:"no-store" });
      if (!health.ok) return;
      const data = await health.json();
      if (data.mode !== "cloud") return;

      const events = new EventSource("/api/events");
      events.onmessage = event => {
        try { renderAI(JSON.parse(event.data)); } catch {}
      };
      events.onerror = () => {};
    } catch {}
  }

  async function checkVersion() {
    try {
      const res = await fetch(`./version.json?t=${Date.now()}`, { cache:"no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const remote = String(data.version || "");
      if (!remote || remote === CURRENT_VERSION) return;

      const u = new URL(location.href);
      u.searchParams.set("v", remote);
      location.replace(u.toString());
    } catch (_) {}
  }

  buildEqualizer();
  updateTimeAndTheme();
  connectCloudAI();

  setInterval(updateTimeAndTheme, 1000);
  setInterval(rotatePrompt, 10000);
  setInterval(checkVersion, 30000);
  setTimeout(checkVersion, 5000);
})();