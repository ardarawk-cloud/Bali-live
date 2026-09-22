(() => {
  const BALI_TZ = "Asia/Makassar";
  const CURRENT_VERSION = "1.2.2";

  const titleEl = document.getElementById("daypartTitle");
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date");
  const promptEl = document.getElementById("prompt");
  const modeLabelEl = document.getElementById("modeLabel");

  const periods = [
    { start:0, end:299, cls:"theme-midnight", title:"BALI MIDNIGHT", mode:"CHILL • MUSIC • MIDNIGHT" },
    { start:300, end:659, cls:"theme-morning", title:"BALI MORNING", mode:"MORNING • MUSIC • BALI" },
    { start:660, end:959, cls:"theme-day", title:"BALI DAY VIBES", mode:"DAY • MUSIC • TROPICAL" },
    { start:960, end:1109, cls:"theme-golden", title:"BALI GOLDEN HOUR", mode:"SUNSET • MUSIC • BALI" },
    { start:1110, end:1439, cls:"theme-night", title:"BALI AFTER DARK", mode:"CHILL • MUSIC • NIGHT" }
  ];

  const prompts = [
    "DROP YOUR CITY IN CHAT",
    "REQUEST SONG: !play SONG - ARTIST",
    "CURHAT KE AI: !curhat PESANMU",
    "ASK BALI AI: !tanya PERTANYAANMU",
    "FUN MODE: !roast • !quote • !jodoh",
    "BALI TIME — WHO IS STILL AWAKE?"
  ];

  function baliParts() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone:BALI_TZ,
      year:"numeric", month:"2-digit", day:"2-digit",
      hour:"2-digit", minute:"2-digit", second:"2-digit",
      hour12:false
    }).formatToParts(new Date());
    return Object.fromEntries(parts.map(p => [p.type,p.value]));
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
    dateEl.textContent = new Intl.DateTimeFormat("en-GB", {
      timeZone:BALI_TZ,
      weekday:"long", day:"2-digit", month:"long", year:"numeric"
    }).format(new Date()).toUpperCase();
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

    // Keep the visualizer visibly alive even inside browser-source/webview environments.
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
  buildRain();
  updateTimeAndTheme();
  setInterval(updateTimeAndTheme, 1000);
  setInterval(rotatePrompt, 10000);
  setInterval(checkVersion, 30000);
  setTimeout(checkVersion, 5000);
})();