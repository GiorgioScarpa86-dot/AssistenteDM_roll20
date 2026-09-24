/* ============================================================
   MOTORE (stessa logica di assistente_dm.html, adattata a
   Tampermonkey: fetch via GM_xmlhttpRequest per evitare CORS)
   ============================================================ */
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function rnd(min,max){ return min + Math.floor(Math.random()*(max-min+1)); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function crNum(cr){
  if (typeof cr === "number") return cr;
  const s = String(cr||"0").trim();
  const p = s.split("/");
  if (p.length === 2) return (+p[0])/(+p[1]);
  return +s || 0;
}
function crLabel(cr){
  const n = crNum(cr);
  if (n === 0) return "0";
  if (n < 1){
    for (const d of [8,4,2]) if (Math.abs(n - 1/d) < 0.001) return "1/"+d;
    return String(n);
  }
  return String(Math.round(n));
}
function xpDaCR(cr){
  const n = crNum(cr);
  if (CR_XP[n] != null) return CR_XP[n];
  return Math.max(10, Math.round(n*200));
}

/* --- fetch JSON via GM_xmlhttpRequest (bypass CORS) --- */
function gmFetchJSON(url, opts){
  opts = opts || {};
  return new Promise((resolve,reject)=>{
    try{
      GM_xmlhttpRequest({
        method: opts.method || "GET",
        url: url,
        headers: opts.headers || {},
        data: opts.body,
        timeout: opts.timeout || 8000,
        onload: r=>{
          if (r.status >= 200 && r.status < 300){
            try{ resolve(JSON.parse(r.responseText)); }
            catch(e){ reject(new Error("risposta non JSON (HTTP " + r.status + ")")); }
          } else {
            let msg = "HTTP " + r.status;
            try{ const j = JSON.parse(r.responseText); msg = (j.error && (j.error.message || j.message)) || j.message || j.detail || msg; if (typeof msg !== "string") msg = JSON.stringify(msg); }catch(e){}
            reject(new Error(msg));
          }
        },
        onerror: ()=>reject(new Error("errore di rete")),
        ontimeout: ()=>reject(new Error("timeout"))
      });
    }catch(e){ reject(e); }
  });
}
const API_MON = "https://www.dnd5eapi.co/api/monsters";

/* --- Stato mostri: parte dal dizionario locale, poi prova l'API online --- */
const state = {
  mostri: L_MOSTRI.map(m=>({ nome:m.n, cr:m.cr, xp:m.xp, locale:m })),
  fonte: "dizionario locale (offline)",
  online: false
};
function elencoDaJson(json){
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.results)) return json.results;
  return [];
}
async function caricaMostriOnline(){
  try{
    const j = await gmFetchJSON(API_MON, {timeout:8000});
    const arr = elencoDaJson(j);
    if (!arr.length) throw new Error("vuoto");
    state.mostri = arr.map(m=>({
      nome:m.name, cr:crNum(m.challenge_rating ?? m.cr ?? 0),
      xp:m.xp ?? m.xp_reward ?? xpDaCR(m.challenge_rating ?? m.cr ?? 0),
      locale:null, url:m.url || null
    }));
    state.fonte = "API SRD (dnd5eapi.co)";
    state.online = true;
    return true;
  }catch(e){
    state.fonte = "dizionario locale (offline)";
    return false;
  }
}
async function dettaglioMostro(m){
  if (m.locale) return m.locale; // oggetto L_MOSTRI già completo
  if (m.url){
    try{
      const r = await gmFetchJSON(/^https?:/.test(m.url) ? m.url : "https://www.dnd5eapi.co"+m.url, {timeout:8000});
      return r;
    }catch(e){ return null; }
  }
  return null;
}

/* --- Budget XP (DMG 5e) --- */
function budgetXp(livello, pcs, diff){
  livello = clamp(Math.round(livello), 1, 20);
  pcs = clamp(Math.round(pcs), 1, 8);
  return Math.round(XP_LIV[livello-1] * pcs * MULT_DIFF[diff]);
}
function generaIncontro(livello, pcs, diff){
  const budget = budgetXp(livello, pcs, diff);
  let pool = state.mostri.filter(m => m.xp > 0 && m.xp <= budget*1.5 && crNum(m.cr) <= livello + 2 && crNum(m.cr) >= 0.25);
  if (pool.length < 4) pool = state.mostri.filter(m => m.xp > 0 && crNum(m.cr) <= livello + 3);
  if (!pool.length) pool = state.mostri.filter(m => m.xp > 0);
  const fit = pool.filter(m=>m.xp <= budget);
  let main;
  if (fit.length){
    const sorted = [...fit].sort((a,b)=>a.xp-b.xp);
    const top = sorted.slice(Math.floor(sorted.length*0.4));
    const pesi = top.map(m=>Math.pow(m.xp, 0.7));
    const tot = pesi.reduce((s,p)=>s+p,0);
    let r = Math.random()*tot, acc = 0;
    for (let i=0;i<top.length;i++){ acc += pesi[i]; if (r <= acc){ main = top[i]; break; } }
    if (!main) main = top[top.length-1];
  } else {
    main = [...pool].sort((a,b)=>a.xp-b.xp)[0];
  }
  const gruppi = new Map();
  const aggiungi = (m,qta)=>{
    const k = m.nome;
    if (gruppi.has(k)) gruppi.get(k).qta += qta;
    else gruppi.set(k, { m, qta, xp:m.xp*qta });
  };
  aggiungi(main, 1);
  let tot = main.xp;
  let guard = 0;
  while (tot < budget*0.9 && gruppi.size < 5 && guard++ < 60){
    const rest = budget - tot;
    let cands = fit.filter(m => m.nome !== main.nome && crNum(m.cr) <= crNum(main.cr)*0.75 && m.xp <= rest);
    if (!cands.length) cands = fit.filter(m => m.nome !== main.nome && m.xp <= rest);
    if (!cands.length) break;
    const chosen = pick(cands);
    aggiungi(chosen, 1);
    tot += chosen.xp;
  }
  if (tot < budget*0.5){
    const k = pick([...gruppi.keys()]);
    const g = gruppi.get(k);
    g.qta += 1; g.xp += g.m.xp; tot += g.m.xp;
  }
  const list = [...gruppi.values()].sort((a,b)=>b.m.cr-a.m.cr);
  return {
    budget, livello, pcs, diff,
    list: list.map(g=>({ nome:g.m.nome, cr:g.m.cr, xp:g.m.xp, qta:g.qta })),
    totale: tot, quota: tot/budget
  };
}
function etichettaQuota(quota){
  if (quota < 0.6) return "Ben più facile del target";
  if (quota < 0.85) return "Leggermente sotto il target";
  if (quota <= 1.2) return "In linea col target";
  if (quota <= 1.5) return "Più pericoloso del target";
  return "Molto sopra il target — scontro epico o mortale";
}

/* --- Parser iniziativa (stesso della versione standalone) --- */
function parseIniziativa(testo){
  const out = [];
  const viste = new Set();
  const linee = String(testo||"").split(/\r?\n/);
  for (const raw of linee){
    const riga = raw.trim();
    if (!riga || riga.length > 120) continue;
    let m, nome, val;
    if ((m = riga.match(/^(.{2,40}?)\s*[:\-–]?\s*\[?\s*(?:1d20|d20)\s*([+-]\s*\d+)?\s*\]?\s*=?\s*(\d{1,2})\b/i))){
      nome = m[1].replace(/[:\-–]\s*$/, "").trim();
      val = +m[3];
    }
    else if ((m = riga.match(/^(\d{1,2})\s*[-–—]\s*(.{2,40})$/))){
      val = +m[1]; nome = m[2].replace(/\s*\[.*$/, "").trim();
    }
    else if ((m = riga.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ'’][\w'’ .\-]{1,39})/))){
      val = +m[1]; nome = m[2].replace(/\s*\(.*/,"").replace(/\s+(iniziat|initiative).*$/i,"").trim();
    }
    else if ((m = riga.match(/^(.{2,40}?)\s*[:\-–]\s*(\d{1,2})\s*(?:\(.*\))?(?:\s*(iniziat|initiative))?/i))){
      nome = m[1].trim(); val = +m[2];
    }
    else if ((m = riga.match(/^(.{2,40}?)\s(\d{1,2})$/))){
      nome = m[1].trim(); val = +m[2];
    }
    if (nome && val != null && val >= 0 && val <= 30){
      nome = nome.replace(/^["“]|["”]$/g,"").trim();
      nome = nome.replace(/^(roll|iniziativ?|initiative)\s*[:\-–]\s*/i, "").trim();
      if (nome && !/^(round|rounds|turn|turno|iniziat|initiative|roll|d20|total)$/i.test(nome)){
        const chiave = nome.toLowerCase();
        if (!viste.has(chiave)){ viste.add(chiave); out.push({nome, init:val}); }
      }
    }
  }
  return out;
}

/* --- PNG / Eventi / Bottino: stessa logica della standalone --- */
function generaPNGProc(){
  const fem = Math.random() < 0.5;
  const nome = pick(fem ? NOMI_F : NOMI_M) + " " + pick(COGNOMI);
  return [
    "NOME: " + nome,
    "RAZZA E RUOLO: " + pick(RAZZE_NPC),
    "ETÀ E ASPETTO: " + rnd(18, 74) + " anni; " + pick(CORPI_NPC) + ", " + pick(DETTAGLI_NPC) + ".",
    "TRATTO CARATTERIALE: " + pick(TRATTI_NPC),
    "IDEALE E COLLEGAMENTO: " + pick(IDEALI_NPC),
    "SEGRETO: " + pick(SEGRETI_NPC),
    "AGGANCIO ALLA TRAMA: " + pick(AGGIANCI_NPC),
    "FRASE ICONICA: \"" + pick(FRASI_NPC) + "\""
  ].join("\n");
}
function generaEventoProc(idBioma){
  const b = L_BIOMI[idBioma];
  return { meteo: pick(b.meteo), evento: pick(b.eventi) };
}
function tiriDadi(dadi){
  const m = String(dadi).match(/(\d+)d(\d+)/i);
  if (!m) return 0;
  let s = 0;
  for (let i=0;i<+m[1];i++) s += 1 + Math.floor(Math.random()*(+m[2]));
  return s;
}
function generaBottino(fascia){
  const monete = LOOT_MONETE[fascia].map(([d,mon])=>({ val:tiriDadi(d), mon }));
  const d20 = rnd(1,20);
  const oggetti = [];
  const prende = (tier,n)=>{ for(let i=0;i<n;i++) oggetti.push({ nome:pick(LOOT_TIERS[tier]), tier }); };
  if (fascia === "0-4"){ if (d20 >= 12) prende("comune",1); }
  else if (fascia === "5-10"){ if (d20 <= 8) prende("comune",1); else if (d20 <= 14) prende("noncomune",1); else { prende("noncomune",1); prende("comune",1); } }
  else if (fascia === "11-16"){ if (d20 <= 6) prende("noncomune",1); else if (d20 <= 12) prende("noncomune",2); else if (d20 <= 16) prende("raro",1); else { prende("raro",1); prende("noncomune",1); } }
  else { if (d20 <= 8) prende("raro",1); else if (d20 <= 14){ prende("raro",1); prende("noncomune",1); } else prende("raro",2); }
  let gp = 0;
  for (const m of monete) gp += m.val * LOOT_VALORI[m.mon];
  for (const o of oggetti) gp += LOOT_VAL_TIERS[o.tier];
  return { monete, oggetti, gp:Math.round(gp) };
}

/* --- LLM (chiave salvata con GM_setValue, resta solo nel browser) --- */
function getLLM(){
  try{ return JSON.parse(GM_getValue("adm_llm","null")) || {}; }catch(e){ return {}; }
}
function llmConfigurato(){
  const s = getLLM();
  return !!(s.provider && s.provider !== "nessuno" && s.key);
}
function chatLLM(sys, user){
  const s = getLLM();
  if (!s.provider || s.provider === "nessuno" || !s.key)
    return Promise.reject(new Error("LLM non configurato (scheda Impostazioni)"));
  const model = s.model || LLM_DEFAULT_MODEL[s.provider];
  let url, headers = { "Content-Type":"application/json" };
  const body = JSON.stringify({ model, temperature:0.9, max_tokens:700,
    messages:[{role:"system",content:sys},{role:"user",content:user}] });
  if (s.provider === "openrouter"){
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers.Authorization = "Bearer " + s.key;
    headers["HTTP-Referer"] = location.origin;
    headers["X-Title"] = "AssistenteDM";
  } else if (s.provider === "groq"){
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers.Authorization = "Bearer " + s.key;
  } else if (s.provider === "huggingface"){
    url = "https://api-inference.huggingface.co/models/" + encodeURIComponent(model) + "/v1/chat/completions";
    headers.Authorization = "Bearer " + s.key;
  } else return Promise.reject(new Error("Provider sconosciuto"));
  return gmFetchJSON(url, {method:"POST", headers, body, timeout:30000}).then(j=>{
    const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!txt) throw new Error("Risposta vuota dal modello");
    return txt.trim();
  });
}
const PROMPT_SYS_NPC = "Sei un creativo di campagne per Dungeons & Dragons 5e, specializzato in personaggi non giocanti memorabili e coerenti con l'ambientazione del master. Rispondi SEMPRE in italiano e SOLO con la scheda richiesta, in questo formato esatto (una riga per campo):\nNOME: ...\nRAZZA E RUOLO: ...\nETÀ E ASPETTO: ...\nTRATTO CARATTERIALE: ...\nIDEALE E COLLEGAMENTO: ...\nSEGRETO: ...\nAGGANCIO ALLA TRAMA: ...\nFRASE ICONICA: \"...\"";
const PROMPT_SYS_EVENT = "Sei un master di D&D 5e. Rispondi SEMPRE in italiano e SOLO con un evento, in questo formato esatto (una riga per campo):\nMETEO: ...\nIMPREVVISTO: ...\nDETTAGLI: ...";

/* --- copia negli appunti --- */
function copiaTesto(testo){
  const ta = document.createElement("textarea");
  ta.value = testo; ta.style.position="fixed"; ta.style.opacity="0";
  document.body.appendChild(ta); ta.select();
  let okc = false;
  try{ okc = document.execCommand("copy"); }catch(e){}
  document.body.removeChild(ta);
  return okc;
}
