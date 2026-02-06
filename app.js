/* Master Bait - Full working single-page game (GitHub Pages friendly)
   Files needed: index.html, styles.css, app.js (all in repo root)
*/

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* -------------------- Screen nav -------------------- */
const screens = {
  menu: $("#screenMenu"),
  map: $("#screenMap"),
  level: $("#screenLevel"),
  mini: $("#screenMini"),
};

function showScreen(name){
  Object.values(screens).forEach(x => x.classList.remove("active"));
  screens[name].classList.add("active");
}

/* -------------------- Theme + Settings -------------------- */
const settings = {
  music: true,
  sfx: true,
  theme: "purpleOrange",
};

function applyTheme(){
  const root = document.documentElement;
  if(settings.theme === "purpleOrange"){
    root.style.setProperty("--accent", "#a855f7");
    root.style.setProperty("--accent2", "#fb923c");
  } else if(settings.theme === "midnightNeon"){
    root.style.setProperty("--accent", "#22d3ee");
    root.style.setProperty("--accent2", "#a3e635");
  } else {
    root.style.setProperty("--accent", "#60a5fa");
    root.style.setProperty("--accent2", "#facc15");
  }
}

/* -------------------- Audio (lazy start; avoids autoplay warning) -------------------- */
const audio = (() => {
  let ctx = null;

  function ensure(){
    if(!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function beep(freq=520, dur=0.06, type="sine", gain=0.12){
    if(!settings.sfx) return;
    const c = ensure();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }

  function chord(){
    beep(260, 0.16, "triangle", 0.10);
    beep(325, 0.16, "triangle", 0.08);
    beep(390, 0.16, "triangle", 0.07);
  }

  function sad(){
    if(!settings.sfx) return;
    const c = ensure();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(340, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(140, c.currentTime + 0.35);
    g.gain.value = 0.10;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.35);
  }

  // soft “music pad” (simple)
  let musicNodes = null;
  function startMusic(mode="chill"){
    stopMusic();
    if(!settings.music) return;
    const c = ensure();

    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    g.gain.value = mode === "tension" ? 0.04 : 0.03;

    o1.type = "sine";
    o2.type = "triangle";
    o1.frequency.value = mode === "tension" ? 90 : 64;
    o2.frequency.value = mode === "tension" ? 135 : 96;

    // subtle LFO
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    lfo.type = "sine";
    lfo.frequency.value = mode === "tension" ? 5 : 2.2;
    lfoG.gain.value = mode === "tension" ? 8 : 4;

    lfo.connect(lfoG);
    lfoG.connect(o2.frequency);

    o1.connect(g); o2.connect(g);
    g.connect(c.destination);

    o1.start(); o2.start(); lfo.start();
    musicNodes = { o1, o2, lfo };
  }

  function stopMusic(){
    if(!musicNodes) return;
    try{ musicNodes.o1.stop(); }catch(e){}
    try{ musicNodes.o2.stop(); }catch(e){}
    try{ musicNodes.lfo.stop(); }catch(e){}
    musicNodes = null;
  }

  return { beep, chord, sad, startMusic, stopMusic, ensure };
})();

/* -------------------- Background particles -------------------- */
(function bg(){
  const c = $("#bg");
  const ctx = c.getContext("2d");
  let w=0,h=0, pts=[];
  function resize(){
    w = c.width = Math.floor(window.innerWidth * devicePixelRatio);
    h = c.height = Math.floor(window.innerHeight * devicePixelRatio);
  }
  window.addEventListener("resize", resize);
  resize();

  function r(min,max){ return min + Math.random()*(max-min); }
  pts = Array.from({length: 90}).map(()=>({
    x:r(0,w), y:r(0,h), r:r(1.0,3.2)*devicePixelRatio,
    vx:r(-0.2,0.2)*devicePixelRatio, vy:r(-0.15,0.15)*devicePixelRatio,
    t:r(0,Math.PI*2)
  }));

  function loop(){
    ctx.clearRect(0,0,w,h);
    for(const p of pts){
      p.t += 0.01;
      p.x += p.vx + Math.sin(p.t)*0.03*devicePixelRatio;
      p.y += p.vy + Math.cos(p.t)*0.03*devicePixelRatio;
      if(p.x<0) p.x=w;
      if(p.x>w) p.x=0;
      if(p.y<0) p.y=h;
      if(p.y>h) p.y=0;

      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();
    }
    requestAnimationFrame(loop);
  }
  loop();
})();

/* -------------------- Coach overlay -------------------- */
const coach = (() => {
  const dock = $("#coachDock");
  const frame = $("#holoFrame");
  const titleEl = $("#coachTitle");
  const bubbleEl = $("#coachBubble");
  const tipEl = $("#coachTip");
  const xpEl = $("#xp");
  const streakEl = $("#streak");

  const btnClose = $("#btnCoachClose");
  const btnNext = $("#btnCoachNext");

  let xp = 0;
  let streak = 0;

  const supportive = [
    "You’re getting sharper. That’s how you stop scams.",
    "Tiny details matter. Your brain is learning the pattern.",
    "Slow is smooth. Smooth is safe.",
    "You’re building real security instincts."
  ];

  function setMood(mood){
    frame.classList.remove("mood-success","mood-warning","mood-fail");
    frame.classList.add(`mood-${mood}`);
  }

  function open(){
    dock.classList.add("show");
    dock.setAttribute("aria-hidden","false");
  }
  function close(){
    dock.classList.remove("show");
    dock.setAttribute("aria-hidden","true");
  }

  async function typeText(text, speed=14){
    bubbleEl.textContent = "";
    for(let i=0;i<text.length;i++){
      bubbleEl.textContent += text[i];
      if(i % 2 === 0) audio.beep(1200, 0.015, "square", 0.03);
      await new Promise(r => setTimeout(r, speed));
    }
  }

  async function show({ mood="warning", title="Feedback", text="", tip="", gainedXP=0, streakDelta=0 }){
    setMood(mood);
    titleEl.textContent = title;

    xp = Math.max(0, xp + gainedXP);
    streak = Math.max(0, streak + streakDelta);
    xpEl.textContent = String(xp);
    streakEl.textContent = String(streak);

    if(tip) tipEl.textContent = tip;

    const cheer = supportive[Math.floor(Math.random()*supportive.length)];
    open();
    await typeText(`${text}\n\n${cheer}`, 14);
  }

  btnClose.addEventListener("click", close);
  btnNext.addEventListener("click", () => {
    close();
    dock.dispatchEvent(new CustomEvent("coach:next"));
  });
  dock.addEventListener("click", (e) => { if(e.target === dock) close(); });

  return { show, close };
})();

/* -------------------- Game data -------------------- */
const LEVELS = [
  { id:1, type:"Email", difficulty:"Easy", time:60, title:"Level 1: Mass Phishing",
    desc:"Generic urgency + suspicious URL.", scenario:"email_mass" },
  { id:2, type:"SMS", difficulty:"Medium", time:55, title:"Level 2: Smishing",
    desc:"Text message uses threat + link.", scenario:"sms_basic" },
  { id:3, type:"Email", difficulty:"Hard", time:45, title:"Level 3: Clone Phishing",
    desc:"Looks like a real brand—tiny details betray it.", scenario:"email_clone" },
  { id:4, type:"Combo", difficulty:"Hard+", time:40, title:"Level 4: Multi-Vector",
    desc:"Email + SMS + distractions.", scenario:"combo" },
];

const EMAIL_SCENARIOS = {
  email_mass: {
    officialPanel: [
      "Official portal: https://portal.example",
      "We never ask for passwords by email",
      "Verify using bookmarks you saved"
    ],
    messages: [
      {
        who:"Streaming Billing",
        from:"support@streaming-billing.example",
        replyTo:"support@streaming-billing.example",
        time:"Today 10:12 AM",
        subject:"Action required: Account suspended",
        bodyHTML: `
          <p>Hello,</p>
          <p>We detected unusual activity. Your account will be <b>suspended in 2 hours</b> unless you verify now.</p>
          <p><span class="hoverhint" data-hint="Urgency + threat is a common phishing pressure trick.">This is urgent.</span></p>
          <p>Verify here:</p>
          <p class="muted small">Use the link chips below to preview the real URL.</p>
          <p>Thanks,<br/>Billing Team</p>
        `,
        links: [
          { label:"Verify Account", url:"https://streaming.example.verify-login.secure-check.ru/login" }
        ],
        truth:"phish",
        bestAction:"report",
        teach:[
          "Red flags: urgency + threat + weird domain ending.",
          "Safest: report it, or call IT for work accounts."
        ]
      },
      {
        who:"Team Calendar",
        from:"calendar@company.example",
        replyTo:"calendar@company.example",
        time:"Yesterday 6:18 PM",
        subject:"Meeting invite updated",
        bodyHTML: `
          <p>Hi,</p>
          <p>The meeting details were updated. Please check via the internal calendar.</p>
          <p class="muted small">Legit messages often point to known internal systems.</p>
        `,
        links: [{ label:"Open Calendar", url:"https://calendar.company.example/event/123" }],
        truth:"safe",
        bestAction:"ignore",
        teach:["Not everything is phishing—still verify sender + domain."]
      }
    ]
  },

  email_clone: {
    officialPanel: [
      "Real sign-in: https://login.microsoftonline.com/",
      "Watch letter swaps: rn vs m",
      "Don’t trust brand name—trust domain"
    ],
    messages: [
      {
        who:"Security Team",
        from:"security@rnicrosoft-support.example",
        replyTo:"security@rnicrosoft-support.example",
        time:"Today 9:06 AM",
        subject:"Security alert: unusual sign-in detected",
        bodyHTML: `
          <p>Dear user,</p>
          <p>We noticed unusual sign-in activity. Confirm your identity to keep access.</p>
          <p><span class="hoverhint" data-hint="Look-alike trick: 'rnicrosoft' uses 'rn' to mimic 'm'.">Brand spelling is suspicious.</span></p>
        `,
        links: [
          { label:"Review Activity", url:"https://rnicrosoft.example-secure-login.com/auth" },
          { label:"Real Login (safe)", url:"https://login.microsoftonline.com/" }
        ],
        truth:"phish",
        bestAction:"callit",
        teach:[
          "Clone phishing copies real brands.",
          "Best move: don’t click—use official site or contact IT."
        ]
      }
    ]
  },

  combo: {
    officialPanel: [
      "Verify via known HR/IT contacts",
      "Never enter passwords from message links",
      "When unsure: Call IT"
    ],
    messages: [
      {
        who:"Payroll",
        from:"payroll@company.example",
        replyTo:"payroll@company.example",
        time:"Today 2:04 PM",
        subject:"Direct deposit updated (confirm?)",
        bodyHTML: `
          <p>Hi,</p>
          <p>We received a request to update direct deposit. If this wasn't you, contact HR via known channels.</p>
        `,
        links: [{ label:"Payroll Portal", url:"https://payroll.company.example/" }],
        truth:"safe",
        bestAction:"ignore",
        teach:["Good messages send you to known internal portals, not random sites."]
      },
      {
        who:"File Storage Admin",
        from:"admin@fileshare-security.example",
        replyTo:"admin@fileshare-security.example",
        time:"Today 2:06 PM",
        subject:"Files will be deleted in 15 minutes",
        bodyHTML: `
          <p>Attention,</p>
          <p>Your files will be deleted in <b>15 minutes</b>. Confirm credentials immediately.</p>
          <p><span class="hoverhint" data-hint="Panic deadline + password request is a classic trap.">This is a pressure tactic.</span></p>
        `,
        links: [{ label:"Prevent Deletion", url:"https://fileshare.company.example.delete-warning.ru/login" }],
        truth:"phish",
        bestAction:"report",
        teach:[
          "Multi-vector attacks create panic on purpose.",
          "Safest: stop, verify, and report."
        ]
      }
    ]
  }
};

const SMS_SCENARIOS = {
  sms_basic: [
    { from:"+1 (403) 555-0199", time:"10:21",
      text:"NOTICE: Your account is suspended. Verify now to avoid penalty.",
      hint:"Threat + urgency in SMS is suspicious." },
    { from:"+1 (403) 555-0199", time:"10:22",
      text:"Confirm here: http://verify-account.example-login.cc/secure",
      hint:"Insecure http + strange domain ending is a red flag." }
  ],
  combo: [
    { from:"Bank Alerts", time:"2:07",
      text:"Unusual purchase detected. Reply YES to lock your card.",
      hint:"Replying can confirm your number to scammers." },
    { from:"Bank Alerts", time:"2:08",
      text:"Update card details: https://bank-secure.example.card-update.ru",
      hint:"Real banks use their official domain, not random endings." }
  ]
};

/* -------------------- State -------------------- */
const STATE = {
  unlocked: 1,
  stars: {1:0,2:0,3:0,4:0},
  selectedLevel: 1,
  clueLog: [],
  hardMode: false,
};

let timerInt = null;
let timeLeft = 0;

let currentMode = "email"; // email / sms / combo
let currentEmailScenarioKey = "email_mass";
let currentEmail = null;

let distractionInt = null;

/* -------------------- Clues -------------------- */
function resetClues(){
  STATE.clueLog = [];
  renderClues();
}

function addClue(text){
  const t = new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  STATE.clueLog.unshift({t, text});
  STATE.clueLog = STATE.clueLog.slice(0, 12);
  renderClues();
}

function renderClues(){
  const box = $("#clueLog");
  box.innerHTML = "";
  if(STATE.clueLog.length === 0){
    box.innerHTML = `<div class="muted small">No clues yet.</div>`;
    return;
  }
  for(const c of STATE.clueLog){
    const div = document.createElement("div");
    div.className = "clueItem";
    div.innerHTML = `<b>${c.t}</b> — ${escapeHtml(c.text)}`;
    box.appendChild(div);
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function bindHoverHints(){
  $$(".hoverhint").forEach(el => {
    el.addEventListener("mouseenter", () => {
      const hint = el.getAttribute("data-hint");
      if(hint) addClue(hint);
      audio.beep(540, 0.03, "sine", 0.06);
    });
  });
}

/* -------------------- Map -------------------- */
const mapNodes = [
  {x:120,y:320},
  {x:360,y:260},
  {x:570,y:240},
  {x:780,y:205},
];

function makeSvgEl(name, attrs){
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for(const [k,v] of Object.entries(attrs||{})) el.setAttribute(k, String(v));
  return el;
}

function drawMap(){
  const g = $("#mapNodes");
  g.innerHTML = "";

  LEVELS.forEach((lv, idx) => {
    const p = mapNodes[idx];
    const locked = lv.id > STATE.unlocked;

    const grp = makeSvgEl("g", { "data-level": lv.id });
    const base = makeSvgEl("circle", {
      cx:p.x, cy:p.y, r:34,
      fill: locked ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.10)",
      stroke: locked ? "rgba(255,255,255,0.12)" : "rgba(168,85,247,0.45)",
      "stroke-width": 2
    });

    const inner = makeSvgEl("circle", {
      cx:p.x, cy:p.y, r:22,
      fill:"rgba(0,0,0,0.18)",
      stroke:"rgba(255,255,255,0.12)",
      "stroke-width": 1
    });

    const num = makeSvgEl("text", {
      x:p.x, y:p.y+8,
      "text-anchor":"middle",
      "font-size":"18",
      "font-family":"ui-monospace, Menlo, Consolas",
      "font-weight":"900",
      fill: locked ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.92)"
    });
    num.textContent = String(lv.id);

    grp.appendChild(base);
    grp.appendChild(inner);
    grp.appendChild(num);

    const s = STATE.stars[lv.id] || 0;
    for(let i=0;i<3;i++){
      const star = makeSvgEl("text", {
        x:p.x - 18 + i*18, y:p.y - 40,
        "text-anchor":"middle",
        "font-size":"16",
        fill: i < s ? "rgba(255,223,88,0.92)" : "rgba(255,255,255,0.18)"
      });
      star.textContent = "★";
      grp.appendChild(star);
    }

    if(!locked){
      grp.style.cursor = "pointer";
      grp.addEventListener("click", () => selectLevel(lv.id));
    }

    g.appendChild(grp);
  });

  selectLevel(STATE.selectedLevel);
}

function selectLevel(id){
  STATE.selectedLevel = id;
  const lv = LEVELS.find(x => x.id === id);
  $("#mapTitle").textContent = `Level ${lv.id}`;
  $("#mapDesc").textContent = lv.desc;

  const s = STATE.stars[lv.id] || 0;
  $("#mStar1").classList.toggle("on", s >= 1);
  $("#mStar2").classList.toggle("on", s >= 2);
  $("#mStar3").classList.toggle("on", s >= 3);
}

let runnerT = 0;
function animateRunner(){
  const path = $("#roadLine");
  const len = path.getTotalLength();
  runnerT = (runnerT + 0.0022) % 1;
  const pt = path.getPointAtLength(len * runnerT);
  $("#runner").setAttribute("cx", pt.x);
  $("#runner").setAttribute("cy", pt.y);
  requestAnimationFrame(animateRunner);
}

/* -------------------- Render Email -------------------- */
function renderEmailScenario(key){
  currentEmailScenarioKey = key;
  const sc = EMAIL_SCENARIOS[key];
  const list = $("#emailList");
  list.innerHTML = "";

  $("#trustLines").innerHTML = sc.officialPanel.map(x => `<div>• ${escapeHtml(x)}</div>`).join("");

  sc.messages.forEach((m, idx) => {
    const item = document.createElement("div");
    item.className = "emailItem" + (idx===0 ? " active" : "");
    item.innerHTML = `
      <div class="who">${escapeHtml(m.who)}</div>
      <div class="sub">${escapeHtml(m.subject)}</div>
      <div class="snip">${escapeHtml(stripTags(m.bodyHTML)).slice(0, 86)}…</div>
    `;
    item.addEventListener("click", () => {
      $$(".emailItem").forEach(x => x.classList.remove("active"));
      item.classList.add("active");
      loadEmail(m);
    });
    list.appendChild(item);
  });

  loadEmail(sc.messages[0]);
}

function stripTags(html){
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || "";
}

function loadEmail(m){
  currentEmail = m;
  $("#emailSubject").textContent = m.subject;
  $("#emailFrom").textContent = `From: ${m.from}`;
  $("#emailReplyTo").textContent = `Reply-To: ${m.replyTo}`;
  $("#emailTime").textContent = `Time: ${m.time}`;
  $("#emailContent").innerHTML = m.bodyHTML;

  const links = $("#emailLinks");
  links.innerHTML = "";
  m.links.forEach(l => {
    const chip = document.createElement("span");
    chip.className = "linkchip hoverhint";
    chip.textContent = l.label;
    chip.setAttribute("data-hint", `Preview URL: ${l.url}`);
    chip.addEventListener("click", () => {
      addClue(`Clicked link chip: ${l.label}`);
      audio.beep(820, 0.05, "sine", 0.10);
    });
    links.appendChild(chip);
  });

  bindHoverHints();
}

/* -------------------- Render SMS -------------------- */
function renderSmsScenario(key){
  const msgs = SMS_SCENARIOS[key] || [];
  const box = $("#smsScreen");
  box.innerHTML = "";

  msgs.forEach(m => {
    const bubble = document.createElement("div");
    bubble.className = "smsBubble hoverhint";
    bubble.setAttribute("data-hint", m.hint);
    bubble.innerHTML = `
      <div>${escapeHtml(m.text)}</div>
      <div class="smsMeta">
        <span>${escapeHtml(m.from)}</span>
        <span>${escapeHtml(m.time)}</span>
      </div>
    `;
    box.appendChild(bubble);
  });

  bindHoverHints();
}

/* -------------------- Level start/stop -------------------- */
function setHardMode(on){
  STATE.hardMode = on;
  $("#toggleHardMode").checked = on;

  // visual glitch on panels
  $("#emailApp").classList.toggle("glitch", on);
  $("#phoneStage").classList.toggle("glitch", on);

  audio.startMusic(on ? "tension" : "chill");
}

function startTimer(seconds){
  clearInterval(timerInt);
  timeLeft = seconds;
  $("#pillTimer").textContent = `⏱ ${timeLeft}s`;

  timerInt = setInterval(() => {
    timeLeft--;
    $("#pillTimer").textContent = `⏱ ${timeLeft}s`;
    if(timeLeft <= 0){
      clearInterval(timerInt);
      handleDecision("timeout");
    }
  }, 1000);
}

function pushNotif(title, text){
  const layer = $("#notifLayer");
  const div = document.createElement("div");
  div.className = "notif";
  div.innerHTML = `<b>${escapeHtml(title)}</b><div class="t">${escapeHtml(text)}</div>`;
  layer.prepend(div);
  setTimeout(() => div.remove(), 5500);
}

function startDistractions(){
  clearInterval(distractionInt);
  $("#notifLayer").innerHTML = "";

  if(!STATE.hardMode) return;

  distractionInt = setInterval(() => {
    const r = Math.random();
    if(r < 0.35) pushNotif("System", "Background update running…");
    else if(r < 0.7) pushNotif("Chat", "Friend: “Click it fast!” (don’t listen)");
    else pushNotif("Reminder", "Breathe. Check the domain.");
  }, 6500);
}

function stopLevel(){
  clearInterval(timerInt);
  clearInterval(distractionInt);
  audio.stopMusic();
  $("#emailApp").classList.remove("glitch");
  $("#phoneStage").classList.remove("glitch");
}

/* -------------------- Truth + scoring -------------------- */
function getTruthPack(){
  const lv = LEVELS.find(x => x.id === STATE.selectedLevel);

  if(currentMode === "sms"){
    return {
      truth: "phish",
      bestAction: "report",
      teach: [
        "Smishing uses urgency + links to steal data.",
        "Safest: report/ignore and verify via official channels."
      ]
    };
  }

  if(currentMode === "email"){
    return {
      truth: currentEmail?.truth || "phish",
      bestAction: currentEmail?.bestAction || "report",
      teach: currentEmail?.teach || ["Check sender + domain + link destination."]
    };
  }

  // combo: if any email in scenario is phish, treat as phish
  const sc = EMAIL_SCENARIOS[lv.scenario];
  const hasPhish = sc.messages.some(m => m.truth === "phish");
  return {
    truth: hasPhish ? "phish" : "safe",
    bestAction: hasPhish ? "report" : "ignore",
    teach: [
      "Multi-vector attacks mix real + fake signals.",
      "Safest: slow down and verify domains."
    ]
  };
}

function score(action, truth, bestAction){
  if(action === "timeout"){
    return { correct:false, stars:0, summary:"Time ran out. Pressure causes mistakes." };
  }

  const safeActions = ["report","ignore","callit"];
  const riskyActions = ["open","reply"];

  let correct = false;
  if(truth === "phish"){
    correct = safeActions.includes(action);
  } else {
    // safe email: any non-risky action acceptable
    correct = !riskyActions.includes(action);
  }

  const clueBonus = Math.min(1, Math.floor(STATE.clueLog.length / 3));
  const speedBonus = timeLeft >= 25 ? 1 : 0;
  const bestBonus = action === bestAction ? 1 : 0;

  let stars = Math.max(0, Math.min(3, 1 + clueBonus + speedBonus + bestBonus));
  if(!correct) stars = Math.max(0, stars - 1);

  const summary =
    correct
      ? "Good choice. You reduced risk and stayed calm."
      : "Risky choice. In real life, this could expose data.";

  return { correct, stars, summary };
}

/* -------------------- Decision handling -------------------- */
async function handleDecision(action){
  stopLevel();

  const lv = LEVELS.find(x => x.id === STATE.selectedLevel);
  const pack = getTruthPack();
  const result = score(action, pack.truth, pack.bestAction);

  if(result.correct) audio.chord();
  else audio.sad();

  // unlock next level if pass
  if(result.correct && STATE.unlocked < lv.id + 1){
    STATE.unlocked = Math.min(LEVELS.length, lv.id + 1);
  }

  // save best stars
  STATE.stars[lv.id] = Math.max(STATE.stars[lv.id] || 0, result.stars);

  const mood =
    action === "timeout" ? "fail" :
    (result.correct && action === pack.bestAction ? "success" :
    (result.correct ? "warning" : "fail"));

  const gainedXP = Math.max(5, (result.stars * 10) + (result.correct ? 10 : 0));
  const streakDelta = result.correct ? 1 : -1;

  await coach.show({
    mood,
    title: mood === "success" ? "Perfect!" : (mood === "fail" ? "Got baited 😬" : "Nice check"),
    text:
      `${result.summary}\n\nKey lessons:\n• ${pack.teach.join("\n• ")}\n\nStars: ${"★".repeat(result.stars)}${"☆".repeat(3-result.stars)}\nYour action: ${action.toUpperCase()}`,
    tip: "When unsure: do NOT click. Go to the official site yourself or Call IT.",
    gainedXP,
    streakDelta
  });
}

/* -------------------- Start a level -------------------- */
function startLevel(id){
  const lv = LEVELS.find(x => x.id === id);
  resetClues();

  $("#levelTitle").textContent = lv.title;
  $("#pillType").textContent = `Type: ${lv.type}`;
  $("#pillDiff").textContent = `Difficulty: ${lv.difficulty}`;

  // set mode
  if(lv.type === "Email") currentMode = "email";
  else if(lv.type === "SMS") currentMode = "sms";
  else currentMode = "combo";

  // show/hide panels
  $("#emailApp").style.display = (currentMode === "sms") ? "none" : "block";
  $("#phoneStage").style.display = (currentMode === "email") ? "none" : "block";

  // render content
  if(currentMode === "email"){
    renderEmailScenario(lv.scenario);
  } else if(currentMode === "sms"){
    renderSmsScenario(lv.scenario);
  } else {
    renderEmailScenario(lv.scenario);
    renderSmsScenario(lv.scenario);
  }

  setHardMode(lv.difficulty.includes("Hard"));
  startDistractions();
  startTimer(lv.time);

  showScreen("level");
}

/* -------------------- Mini games -------------------- */
const FLASHCARDS = [
  { front:"Mass Phishing", back:"Generic message to many people. Red flags: urgency + weird links." },
  { front:"Smishing", back:"SMS phishing. Red flags: short links, threats, asks for personal info." },
  { front:"Clone Phishing", back:"Copies a brand but swaps tiny details (domain/spelling)." },
  { front:"Spear Phishing", back:"Targets a specific person/team with a believable request." }
];

let cardIdx = 0;
let flipped = false;

function renderCard(){
  const c = FLASHCARDS[cardIdx];
  $("#flashTitle").textContent = c.front;
  $("#flashBody").textContent = flipped ? c.back : "Click Flip to reveal the answer.";
}

function newPickRound(){
  const wrap = $("#pickWrap");
  wrap.innerHTML = "";

  const rounds = [
    { real:"microsoft.com", fakes:["rnicrosoft.com","micros0ft.com","microsoft-support.ru"] },
    { real:"paypal.com", fakes:["paypaI.com","pay-pal.verify.cc","paypal-security.ru"] },
    { real:"amazon.ca", fakes:["arnazon.ca","amazon.verify-login.ru","amaz0n.ca"] }
  ];
  const r = rounds[Math.floor(Math.random()*rounds.length)];
  const opts = [r.real, ...r.fakes].sort(() => Math.random() - 0.5);

  opts.forEach(opt => {
    const b = document.createElement("button");
    b.className = "pickBtn";
    b.textContent = opt;
    b.addEventListener("click", async () => {
      const correct = opt === r.real;
      if(correct) audio.chord(); else audio.sad();
      await coach.show({
        mood: correct ? "success" : "fail",
        title: correct ? "Correct!" : "Nope!",
        text: correct
          ? `You chose the real domain: ${r.real}`
          : `That domain is suspicious.\nReal domain was: ${r.real}`,
        tip: "Look for letter swaps: rn vs m, 0 vs o, I vs l.",
        gainedXP: correct ? 20 : 8,
        streakDelta: correct ? 1 : -1
      });
    });
    wrap.appendChild(b);
  });
}

/* -------------------- Modals -------------------- */
function openModal(el){ el.classList.add("show"); el.setAttribute("aria-hidden","false"); }
function closeModal(el){ el.classList.remove("show"); el.setAttribute("aria-hidden","true"); }

/* -------------------- Wire up UI -------------------- */
function wireUI(){
  // ensure audio can start after first click
  document.addEventListener("click", () => audio.ensure(), { once:true });

  $("#btnPlay").addEventListener("click", () => {
    audio.startMusic("chill");
    showScreen("map");
    drawMap();
  });

  $("#btnMini").addEventListener("click", () => {
    audio.startMusic("chill");
    showScreen("mini");
    renderCard();
    newPickRound();
  });

  $("#btnMiniBack").addEventListener("click", () => {
    showScreen("menu");
  });

  $("#btnBackMenu").addEventListener("click", () => {
    audio.startMusic("chill");
    showScreen("menu");
  });

  $("#btnStartSelected").addEventListener("click", () => {
    startLevel(STATE.selectedLevel);
  });

  $("#btnExitLevel").addEventListener("click", () => {
    stopLevel();
    audio.startMusic("chill");
    showScreen("map");
    drawMap();
  });

  $("#toggleHardMode").addEventListener("change", (e) => {
    setHardMode(e.target.checked);
    startDistractions();
  });

  // Email actions
  $$(".emailApp .mini").forEach(b => {
    b.addEventListener("click", () => {
      const action = b.dataset.action;
      audio.beep(700, 0.04, "triangle", 0.08);
      handleDecision(action);
    });
  });

  // SMS actions
  $$(".phoneActions button").forEach(b => {
    b.addEventListener("click", () => {
      const action = b.dataset.sms;
      audio.beep(700, 0.04, "triangle", 0.08);
      handleDecision(action);
    });
  });

  // Coach next returns to map
  $("#coachDock").addEventListener("coach:next", () => {
    showScreen("map");
    drawMap();
    audio.startMusic("chill");
  });

  // Flashcard controls
  $("#flashcard").addEventListener("click", () => { flipped = !flipped; renderCard(); });
  $("#btnFlip").addEventListener("click", () => { flipped = !flipped; renderCard(); });
  $("#btnNextCard").addEventListener("click", () => { cardIdx = (cardIdx+1)%FLASHCARDS.length; flipped=false; renderCard(); });

  $("#btnPickNew").addEventListener("click", newPickRound);

  // Settings modal
  const settingsModal = $("#settingsModal");
  $("#btnSettings").addEventListener("click", () => {
    $("#toggleMusic").checked = settings.music;
    $("#toggleSfx").checked = settings.sfx;
    $("#themeSelect").value = settings.theme;
    openModal(settingsModal);
  });
  $("#btnCloseSettings").addEventListener("click", () => closeModal(settingsModal));
  settingsModal.addEventListener("click", (e) => { if(e.target === settingsModal) closeModal(settingsModal); });

  $("#toggleMusic").addEventListener("change", (e) => {
    settings.music = e.target.checked;
    if(settings.music) audio.startMusic("chill"); else audio.stopMusic();
  });
  $("#toggleSfx").addEventListener("change", (e) => {
    settings.sfx = e.target.checked;
    audio.beep(520, 0.05, "sine", 0.08);
  });
  $("#themeSelect").addEventListener("change", (e) => {
    settings.theme = e.target.value;
    applyTheme();
  });

  // Help modal
  const helpModal = $("#helpModal");
  $("#btnHelp").addEventListener("click", () => openModal(helpModal));
  $("#btnCloseHelp").addEventListener("click", () => closeModal(helpModal));
  helpModal.addEventListener("click", (e) => { if(e.target === helpModal) closeModal(helpModal); });
}

/* -------------------- Boot -------------------- */
applyTheme();
wireUI();
drawMap();
animateRunner();
audio.startMusic("chill");
showScreen("menu");
renderCard();
newPickRound();
