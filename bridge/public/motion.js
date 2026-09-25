const songPopup=document.getElementById("songPopup");
const songTitle=document.getElementById("songTitle");
const songArtist=document.getElementById("songArtist");
const stationId=document.getElementById("stationId");
const eventAlert=document.getElementById("eventAlert");
const eventIcon=document.getElementById("eventIcon");
const eventType=document.getElementById("eventType");
const eventName=document.getElementById("eventName");
const eventDetail=document.getElementById("eventDetail");
const tickerText=document.getElementById("tickerText");

let lastTrackKey="";
let lastAlertId="";
let lastStation=false;
let popupTimer=null;
let alertTimer=null;
let currentTrack={title:"",artist:""};
let tickerIndex=0;

const ctas=[
  "BALI LIVE RADIO • 24/7 FROM BALI",
  "REQUEST SONG • !play JUDUL LAGU - ARTIS",
  "FOLLOW + SHARE • KEEP THE RADIO MOVING",
  "FROM BALI TO THE WORLD"
];

function showSong(track){
  const key=(track.title+"|"+track.artist).trim();
  if(!track.title || key===lastTrackKey) return;
  lastTrackKey=key;
  currentTrack=track;
  songTitle.textContent=track.title;
  songArtist.textContent=track.artist || "BALI LIVE RADIO";
  songPopup.classList.remove("hidden");
  clearTimeout(popupTimer);
  popupTimer=setTimeout(()=>songPopup.classList.add("hidden"),6500);
}

function showStation(station){
  const active=Boolean(station?.active);
  if(active!==lastStation){
    lastStation=active;
    stationId.classList.toggle("hidden",!active);
  }
}

function showAlert(alert){
  if(!alert || !alert.id || alert.id===lastAlertId || Date.now()>Number(alert.expiresAt||0)) return;
  lastAlertId=alert.id;
  const map={
    gift:["★","GIFT RECEIVED"],
    follow:["＋","NEW FOLLOWER"],
    share:["↗","LIVE SHARED"],
    join:["●","WELCOME"]
  };
  const meta=map[alert.type]||["★","LIVE EVENT"];
  eventIcon.textContent=meta[0];
  eventType.textContent=meta[1];
  eventName.textContent="@"+(alert.username||alert.nickname||"viewer").replace(/^@/,"");
  eventDetail.textContent=alert.detail||"BALI LIVE RADIO";
  eventAlert.classList.remove("hidden");
  clearTimeout(alertTimer);
  alertTimer=setTimeout(()=>eventAlert.classList.add("hidden"),6500);
}

function render(s){
  if(!s) return;
  if(s.track) showSong(s.track);
  showStation(s.station);
  showAlert(s.alert);
}

function rotateTicker(){
  const items=[];
  if(currentTrack.title){
    items.push("♫ NOW PLAYING • "+currentTrack.title+(currentTrack.artist?" — "+currentTrack.artist:""));
  }
  items.push(...ctas);
  tickerIndex=(tickerIndex+1)%items.length;
  tickerText.textContent=items[tickerIndex];
}
setInterval(rotateTicker,12000);

let fallbackTimer=null;
async function poll(){
  try{
    const r=await fetch("/api/motion?t="+Date.now(),{cache:"no-store"});
    render(await r.json());
  }catch{}
}
function startFallback(){
  if(fallbackTimer) return;
  fallbackTimer=setInterval(poll,1200);
  poll();
}
function connect(){
  if(!("EventSource" in window)){startFallback();return;}
  const es=new EventSource("/api/motion/events");
  es.onmessage=e=>{try{render(JSON.parse(e.data))}catch{}};
  es.onopen=()=>{if(fallbackTimer){clearInterval(fallbackTimer);fallbackTimer=null;}};
  es.onerror=()=>{es.close();startFallback();setTimeout(connect,1800);};
}
connect();
