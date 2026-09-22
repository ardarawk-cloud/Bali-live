(() => {
  const BALI_TZ = "Asia/Makassar";
  const CURRENT_VERSION = "1.2.0";

  const titleEl = document.getElementById("daypartTitle");
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date");
  const promptTextEl = document.querySelector(".prompt-text");
  const modeLabelEl = document.getElementById("modeLabel");

  const periods = [
    {
      key:"midnight",
      start:0,
      end:299,
      cls:"theme-midnight",
      title:"BALI MIDNIGHT",
      mode:"MIDNIGHT • MUSIC • AI",
      prompts:[
        "CURHAT KE AI: !curhat PESANMU",
        "LATE NIGHT QUESTION: !ai PERTANYAANMU",
        "REQUEST SONG: !play SONG - ARTIST",
        "WHO IS STILL AWAKE? DROP YOUR CITY"
      ]
    },
    {
      key:"morning",
      start:300,
      end:659,
      cls:"theme-morning",
      title:"BALI MORNING",
      mode:"MORNING • MUSIC • BALI",
      prompts:[
        "GOOD MORNING — DROP YOUR CITY IN CHAT",
        "CURHAT KE AI: !curhat PESANMU",
        "REQUEST SONG: !play SONG - ARTIST",
        "ASK BALI AI: !ai PERTANYAANMU"
      ]
    },
    {
      key:"day",
      start:660,
      end:959,
      cls:"theme-day",
      title:"BALI DAY VIBES",
      mode:"DAY • MUSIC • TROPICAL",
      prompts:[
        "WHERE ARE YOU WATCHING FROM?",
        "REQUEST SONG: !play SONG - ARTIST",
        "ASK BALI AI: !ai PERTANYAANMU",
        "FUN MODE: !roast • !quote • !jodoh"
      ]
    },
    {
      key:"golden",
      start:960,
      end:1109,
      cls:"theme-golden",
      title:"BALI GOLDEN HOUR",
      mode:"SUNSET • MUSIC • BALI",
      prompts:[
        "SUNSET SONG REQUEST: !play SONG - ARTIST",
        "CURHAT KE AI: !curhat PESANMU",
        "DROP YOUR CITY IN CHAT",
        "ASK BALI AI: !ai PERTANYAANMU"
      ]
    },
    {
      key:"night",
      start:1110,
      end:1439,
      cls:"theme-night",
      title:"BALI AFTER DARK",
      mode:"NIGHT • MUSIC • AI",
      prompts:[
        "BALI AFTER DARK — SAY HI IN CHAT",
        "REQUEST SONG: !play SONG - ARTIST",
        "CURHAT KE AI: !curhat PESANMU",
        "FUN MODE: !roast • !quote • !jodoh"
      ]
    }
  ];

  let activePeriod = periods[4];
  let promptIndex = 0;

  function baliParts() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone:BALI_TZ,
      year:"numeric",
      month:"2-digit",
      day:"2-digit",
      hour:"2-digit",
      minute:"2-digit",
      second:"2-digit",
      hourCycle:"h23"
    }).formatToParts(new Date());

    return Object.fromEntries(parts.map(p => [p.type, p.value]));
  }

  function setPrompt(text) {
    if (!promptTextEl) return;
    promptTextEl.animate(
      [
        { opacity:0, transform:"translateY(4px)" },
        { opacity:1, transform:"translateY(0)" }
      ],
      { duration:260, easing:"ease-out" }
    );
    promptTextEl.textContent = text;
  }

  function updateTimeAndTheme() {
    const p = baliParts();
    const mins = Number(p.hour) * 60 + Number(p.minute);
    const nextPeriod = periods.find(x => mins >= x.start && mins <= x.end) || periods[4];

    if (nextPeriod.key !== activePeriod.key) {
      activePeriod = nextPeriod;
      promptIndex = 0;
      setPrompt(activePeriod.prompts[0]);
    }

    document.body.classList.remove(
      "theme-morning",
      "theme-day",
      "theme-golden",
      "theme-night",
      "theme-midnight"
    );
    document.body.classList.add(activePeriod.cls);

    titleEl.textContent = activePeriod.title;
    modeLabelEl.textContent = activePeriod.mode;
    clockEl.textContent = `${p.hour}:${p.minute}:${p.second}`;

    dateEl.textContent = new Intl.DateTimeFormat("en-GB", {
      timeZone:BALI_TZ,
      weekday:"long",
      day:"2-digit",
      month:"long",
      year:"numeric"
    }).format(new Date()).toUpperCase();
  }

  function buildEqualizer() {
    const eq = document.getElementById("equalizer");
    if (!eq) return;

    const heights = [12,21,34,27,42,31,19,38,46,29,17,24,40,33,21,15,30,37,24,13];
    heights.forEach((height, i) => {
      const bar = document.createElement("span");
      bar.className = "bar";
      bar.style.height = `${height}px`;
      bar.style.animationDuration = `${0.46 + (i % 6) * 0.09}s`;
      bar.style.animationDelay = `${-(i % 5) * 0.13}s`;
      eq.appendChild(bar);
    });
  }

  function buildParticles() {
    const layer = document.getElementById("rain");
    if (!layer) return;

    for (let i = 0; i < 26; i++) {
      const particle = document.createElement("span");
      particle.className = "particle";

      const size = 1 + (i % 3);
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${(i * 37) % 100}%`;
      particle.style.top = `${(i * 19) % 100}%`;
      particle.style.opacity = `${0.10 + (i % 5) * 0.06}`;
      particle.style.animationDuration = `${9 + (i % 7) * 1.7}s`;
      particle.style.animationDelay = `${-(i % 9) * 1.1}s`;

      layer.appendChild(particle);
    }
  }

  function rotatePrompt() {
    if (!activePeriod.prompts.length) return;
    promptIndex = (promptIndex + 1) % activePeriod.prompts.length;
    setPrompt(activePeriod.prompts[promptIndex]);
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

  const firstParts = baliParts();
  const firstMinutes = Number(firstParts.hour) * 60 + Number(firstParts.minute);
  activePeriod = periods.find(x => firstMinutes >= x.start && firstMinutes <= x.end) || periods[4];

  buildEqualizer();
  buildParticles();
  setPrompt(activePeriod.prompts[0]);
  updateTimeAndTheme();

  setInterval(updateTimeAndTheme, 1000);
  setInterval(rotatePrompt, 9000);
  setInterval(checkVersion, 30000);
  setTimeout(checkVersion, 4500);
})();