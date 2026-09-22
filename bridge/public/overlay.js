const card = document.getElementById("card");
const viewer = document.getElementById("viewer");
const command = document.getElementById("command");
const question = document.getElementById("question");
const answer = document.getElementById("answer");
const thinking = document.getElementById("thinking");

let lastKey = "";

async function poll(){
  try{
    const r = await fetch("/api/state?t="+Date.now(), {cache:"no-store"});
    const s = await r.json();

    if(!s.active){
      card.classList.add("hidden");
      return;
    }

    const key = [s.createdAt,s.status,s.answer].join("|");
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
  }catch{
    card.classList.add("hidden");
  }
}

setInterval(poll, 500);
poll();
