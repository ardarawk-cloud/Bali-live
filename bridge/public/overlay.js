const card = document.getElementById("card");
const viewer = document.getElementById("viewer");
const avatar = document.getElementById("avatar");
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

  const key = [s.createdAt,s.status,s.answer,s.question,s.username].join("|");
  if(key !== lastKey){
    lastKey = key;
    const handle = s.username || s.nickname || "viewer";
    command.textContent = "!" + (s.command || "ai");
    viewer.textContent = "@" + handle;
    avatar.textContent = String(handle).replace(/^@/,"").charAt(0).toUpperCase() || "A";
    question.textContent = s.question || "";

    const isThinking = s.status === "thinking";
    thinking.style.display = isThinking ? "flex" : "none";
    answer.style.display = isThinking ? "none" : "block";
    answer.textContent = s.answer || "";

    card.classList.toggle("answering", !isThinking);
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
  fallbackTimer = setInterval(poll, 1000);
  poll();
}

function connectEvents(){
  if(!("EventSource" in window)){
    startFallback();
    return;
  }

  const es = new EventSource("/api/events");
  es.onmessage = event => {
    try{ render(JSON.parse(event.data)); }catch{}
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
    setTimeout(connectEvents, 1600);
  };
}

connectEvents();