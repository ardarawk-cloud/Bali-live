const card = document.getElementById("card");
const viewer = document.getElementById("viewer");
const command = document.getElementById("command");
const question = document.getElementById("question");
const answer = document.getElementById("answer");
const thinking = document.getElementById("thinking");

let lastKey = "";
let fallbackTimer = null;

function render(s){
  if(!s || !s.active){
    card.classList.add("hidden");
    return;
  }

  const key = [s.createdAt,s.status,s.answer,s.question].join("|");
  if(key !== lastKey){
    lastKey = key;
    command.textContent = "!" + (s.command || "ai");
    viewer.textContent = "@" + (s.username || s.nickname || "viewer");
    question.textContent = s.question || "";

    const isThinking = s.status === "thinking";
    thinking.style.display = isThinking ? "block" : "none";
    answer.style.display = isThinking ? "none" : "block";
    answer.textContent = s.answer || "";
  }

  card.classList.remove("hidden");
}

async function poll(){
  try{
    const r = await fetch("/api/state?t="+Date.now(), {cache:"no-store"});
    render(await r.json());
  }catch{
    card.classList.add("hidden");
  }
}

function startFallback(){
  if(fallbackTimer) return;
  fallbackTimer = setInterval(poll, 1200);
  poll();
}

function connectEvents(){
  if(!("EventSource" in window)){
    startFallback();
    return;
  }

  const es = new EventSource("/api/events");

  es.onmessage = event => {
    try{
      render(JSON.parse(event.data));
    }catch{}
  };

  es.onopen = () => {
    if(fallbackTimer){
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  };

  es.onerror = () => {
    es.close();
    startFallback();
    setTimeout(connectEvents, 1500);
  };
}

connectEvents();
