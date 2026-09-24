/* ============================================================
   4) MOTORE LOGICO — nessuna dipendenza esterna
   ------------------------------------------------------------
   4.1 Utility generali
   4.2 API SRD (fetch con fallback multi-sorgente)
   4.3 Budget XP e generatore di scontri bilanciati
   4.4 Parser iniziativa (testo chat Roll20 incollato)
   4.5 Generatore di PNG (procedurale + LLM)
   4.6 Generatore meteo/imprevisti (procedurale + LLM)
   4.7 Generatore di bottino
   4.8 Cliente LLM (OpenRouter / Groq / Hugging Face)
   ============================================================ */

/* ---------- 4.1 Utility ---------- */
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function rnd(min,max){ return min + Math.floor(Math.random()*(max-min+1)); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
// converte un CR (numero 0.25, stringa "1/4"…) in numero
function crNum(cr){
  if (typeof cr === "number") return cr;
  const s = String(cr||"0").trim();
  const p = s.split("/");
  if (p.length === 2) return (+p[0])/(+p[1]);
  return +s || 0;
}
// formatta un CR in modo leggibile (0.25 → "1/4")
function crLabel(cr){
  const n = crNum(cr);
  if (n === 0) return "0";
  if (n < 1){
    for (const d of [8,4,2]){
      if (Math.abs(n - 1/d) < 0.001) return "1/"+d;
    }
    return String(n);
  }
  return String(Math.round(n));
}
function xpDaCR(cr){
  const n = crNum(cr);
  if (CR_XP[n] != null) return CR_XP[n];
  return Math.max(10, Math.round(n*200));
}
// copia testo negli appunti con fallback per file://
function copiaTesto(testo){
  if (navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(testo).catch(()=>fallbackCopia(testo));
  }
  return Promise.resolve(fallbackCopia(testo));
}
function fallbackCopia(testo){
  const ta = document.createElement("textarea");
  ta.value = testo; ta.style.position="fixed"; ta.style.opacity="0";
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand("copy"); }catch(e){}
  document.body.removeChild(ta);
  return Promise.resolve();
}
// fetch JSON con timeout (per non bloccare l'app se un'API impazzisce); accetta header opzionali
function fetchJSON(url, ms, headers){
  ms = ms || 8000;
  return new Promise((resolve,reject)=>{
    const c = new AbortController();
    const t = setTimeout(()=>{ c.abort(); reject(new Error("timeout")); }, ms);
    fetch(url, {signal:c.signal, headers: headers || {}})
      .then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
      .then(j=>{ clearTimeout(t); resolve(j); })
      .catch(e=>{ clearTimeout(t); reject(e); });
  });
}
// elenco dei modelli attualmente gratuiti:
// - OpenRouter: API pubblica (nessuna chiave richiesta), filtra gli ID ":free" che accettano testo in ingresso/uscita
// - Groq: lista reale dei modelli, richiede la chiave già incollata
async function listaModelliFree(provider, key){
  if (provider === "openrouter"){
    const j = await fetchJSON("https://openrouter.ai/api/v1/models", 12000);
    const arr = Array.isArray(j) ? j : (j.data || []);
    const out = [];
    for (const m of arr){
      const id = m.id || "";
      if (!id.endsWith(":free")) continue;
      const arch = m.architecture || {};
      const inp = (arch.input_modalities || []).join(",");
      const outm = (arch.output_modalities || []).join(",");
      if (!/text/.test(inp) || !/text/.test(outm)) continue; // solo modelli di chat
      if (/embedding|rerank|tts|transcribe|speech|caption/i.test(id)) continue;
      const ctx = m.context_length ? " · " + Math.round(m.context_length/1000) + "K ctx" : "";
      out.push({ id, nome: (m.name || id) + ctx });
    }
    return out.sort((a,b)=>a.id.localeCompare(b.id));
  }
  if (provider === "groq" && key){
    const j = await fetchJSON("https://api.groq.com/openai/v1/models", 12000, {Authorization:"Bearer "+key});
    return (j.data || []).map(m=>({id:m.id, nome:m.id})).sort((a,b)=>a.id.localeCompare(b.id));
  }
  return null;
}

/* ---------- 4.2 API SRD: più fonti, in ordine, con fallback locale ---------- */
const API_SOURCES = [
  { nome:"5e SRD API (5e-srdapi.com)", mon:"https://5e-srdapi.com/monsters", spell:"https://5e-srdapi.com/spells" },
  { nome:"D&D 5e SRD API (dnd5eapi.co)", mon:"https://www.dnd5eapi.co/api/monsters", spell:"https://www.dnd5eapi.co/api/spells" }
];
const DND5E_BASE = "https://www.dnd5eapi.co";

// Stato dati: si parte subito col dizionario locale (l'app funziona anche offline),
// poi si prova a salire all'API. Ogni successo aggiornà la lista.
const state = {
  mostri: L_MOSTRI.map(m=>({ nome:m.n, cr:m.cr, xp:m.xp, locale:m })),
  incantesimi: L_SPELLS.map(s=>({ nome:s.n, liv:s.liv, locale:s })),
  fonte: "Dizionario locale (offline)",
  fonteApi: false
};

// estrae un "elenco" dall'json grezzo di qualunque API (array, .results, .data…)
function elencoDaJson(json){
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.results)) return json.results;
  if (json && Array.isArray(json.data)) return json.data;
  return [];
}

// normalizza un mostro grezzo (gestisce i formati 2014 di dnd5eapi e quello di 5e-srdapi)
function normalizzaMostro(r){
  // Armor Class: numero | {score} | [{type,value}]
  let ca = null;
  if (typeof r.armor_class === "number") ca = r.armor_class;
  else if (r.armor_class && typeof r.armor_class === "object"){
    if (r.armor_class.score != null) ca = r.armor_class.score;
    else if (Array.isArray(r.armor_class)) ca = r.armor_class.reduce((m,a)=>Math.max(m, a.value||0), 0);
  }
  // Hit Points: numero | {number|dice}
  let pv = null, tiri = null;
  if (typeof r.hit_points === "number") pv = r.hit_points;
  else if (r.hit_points && typeof r.hit_points === "object") pv = r.hit_points.number;
  tiri = r.hit_points_roll || r.hit_dice || null;
  if (pv == null && typeof tiri === "string") tiri = tiri; // mostriamo i dadi
  // Abilità: formato nuovo (strength…) oppure {abilities:{str:{score}}}
  const A = r.abilities || {};
  const ab = [
    r.strength ?? A.str?.score, r.dexterity ?? A.dex?.score, r.constitution ?? A.con?.score,
    r.intelligence ?? A.int?.score, r.wisdom ?? A.wis?.score, r.charisma ?? A.cha?.score
  ];
  const cr = (r.challenge_rating ?? r.cr ?? 0);
  const xp = r.xp ?? r.xp_reward ?? xpDaCR(cr);
  const vel = r.speed && typeof r.speed === "object"
    ? Object.entries(r.speed).filter(([k])=>k!=="hover").map(([k,v])=>k==="walk"?(v+" ft"):(k+" "+v+" ft")).join(", ")
    : (r.speed || "");
  const tra = (r.special_abilities || r.traits || []).map(t=>({n:t.name, d:t.desc || t.description || ""}));
  const az  = (r.actions || []).map(a=>({n:a.name, d:a.desc || a.description || ""}));
  const leg = (r.legendary_actions || []).map(a=>({n:a.name, d:a.desc || a.description || ""}));
  let res = r.damage_resistances, imm = r.damage_immunities, vul = r.damage_vulnerabilities;
  res = Array.isArray(res)?res:[]; imm = Array.isArray(imm)?imm:[]; vul = Array.isArray(vul)?vul:[];
  // salvezze provette: dal formato 2014 (proficiencies) o da saves
  let sal = [];
  if (r.saves && typeof r.saves === "object"){
    sal = Object.entries(r.saves)
      .map(([k,v])=>{
        const bonus = (typeof v === "object" && v !== null) ? (v.score!=null ? "+"+v.score : "") : (v!=null ? String(v) : "");
        return bonus ? k.toUpperCase()+" "+bonus : null;
      }).filter(Boolean);
  } else if (Array.isArray(r.proficiencies)){
    sal = r.proficiencies.filter(p=>/saving/i.test(p.proficiency?.name||"")).map(p=>p.proficiency.name.replace("Saving Throw: ","")+" "+p.value);
  }
  return {
    nome:r.name, t:r.type+(r.subtype?" ("+r.subtype+")":""), allineamento:r.alignment||"",
    cr:crNum(cr), xp, ca, pv, tiri, vel, ab, sal, vul, res, imm, tra, az, leg,
    sensi:r.senses ? Object.entries(r.senses).map(([k,v])=>k+": "+v).join(" · ") : "",
    lingue:r.languages || "", size:r.size||""
  };
}

// normalizza un incantesimo grezzo
function normalizzaIncantesimo(r){
  const v = x => (x && typeof x === "object") ? (x.value ?? "") : (x ?? "");
  let desc = r.desc || r.description || "";
  if (Array.isArray(desc)) desc = desc.join(" ");
  let hl = r.higher_level || r.higher_levels || "";
  if (Array.isArray(hl)) hl = hl.join(" ");
  let comp = r.components;
  if (Array.isArray(comp)) comp = comp.join(", ");
  else if (comp && typeof comp === "object") comp = v(comp) || [comp.verbal&&"V", comp.somatic&&"S", comp.material&&"M"].filter(Boolean).join(", ");
  return {
    nome:r.name, liv:r.level ?? 0, sc:v(r.school) || (r.school&&r.school.name) || "",
    ct:v(r.casting_time), rg:v(r.range), comp, dur:v(r.duration),
    con:!!(r.concentration === true || v(r.concentration) === "yes" || v(r.concentration) === "true"),
    desc, hl,
    classi:(r.classes||[]).map(c=>c.name).join(", ")
  };
}

// carica i dati dall'API (prova le fonti in sequenza). Lascia intatti i dati locali in caso di fallimento.
// Mostri e incantesimi hanno cicli indipendenti: se un'API fallisce, l'altra parte resta comunque salvata.
async function caricaDatiApi(onStatus){
  let okMon = false;
  for (const src of API_SOURCES){
    try{
      const jm = await fetchJSON(src.mon, 8000);
      const lm = elencoDaJson(jm);
      if (!lm.length) throw new Error("lista vuota");
      // se gli elementi sono già completi (es. 5e-srdapi) usiamoli, altrimenti (solo nomi) teniamo l'url per i dettagli
      state.mostri = lm.map(m=>{
        const completo = (m.hit_points != null || m.armor_class != null || m.xp_reward != null || m.xp != null);
        return { nome:m.name, cr:crNum(m.challenge_rating ?? m.cr ?? 0), xp:m.xp ?? m.xp_reward ?? xpDaCR(m.challenge_rating ?? m.cr ?? 0),
                 locale: completo ? m : null, url: m.url || null };
      });
      state.fonte = src.nome;
      state.fonteApi = true;
      okMon = true;
      onStatus("monsters", src.nome);
      break;
    }catch(e){
      // sorgente non disponibile: passa alla successiva
    }
  }
  for (const src of API_SOURCES){
    try{
      const js = await fetchJSON(src.spell, 8000);
      const ls = elencoDaJson(js);
      if (!ls.length) throw new Error("vuoto");
      state.incantesimi = ls.map(s=>{
        const completo = (s.casting_time != null || s.level != null);
        return { nome:s.name, liv:s.level ?? 0, locale: completo ? s : null, url: s.url || null };
      });
      onStatus("spells", src.nome);
      break;
    }catch(e){
      // sorgente non disponibile: passa alla successiva
    }
  }
  return okMon;
}

// recupera il dettaglio completo di un mostro:
// - oggetto locale completo (chiave "n" del dizionario) → converter locale
// - oggetto API completo (chiave "name") → normalizzatore
// - altrimenti fetch del dettaglio via url
async function dettaglioMostro(m){
  if (m.locale){
    if (m.locale.n) return mostroLocaleADettaglio(m.locale);
    return normalizzaMostro(m.locale);
  }
  if (m.url){
    const url = /^https?:/.test(m.url) ? m.url : DND5E_BASE + m.url;
    try{ return normalizzaMostro(await fetchJSON(url, 8000)); }
    catch(e){ /* API offline: il chiamante mostra il messaggio di fallback */ }
  }
  return null;
}
async function dettaglioIncantesimo(s){
  if (s.locale){
    if (s.locale.n) return incantesimoLocaleADettaglio(s.locale);
    return normalizzaIncantesimo(s.locale);
  }
  if (s.url){
    const url = /^https?:/.test(s.url) ? s.url : DND5E_BASE + s.url;
    try{ return normalizzaIncantesimo(await fetchJSON(url, 8000)); }
    catch(e){ /* fallback sopra */ }
  }
  return null;
}

// costruisce l'oggetto "dettaglio" da un mostro del dizionario locale
function mostroLocaleADettaglio(m){
  const L = m; // m è l'oggetto L_MOSTRI originale (chiavi: n, t, cr, ca, pv…)
  return {
    nome:L.n, t:L.t, allineamento:"", cr:L.cr, xp:L.xp, ca:L.ca, pv:L.pv, tiri:L.tiri, vel:L.vel,
    ab:L.ab, sal:[], vul:L.vul, res:L.res, imm:L.imm,
    tra:L.tra.map(x=>({n:x[0],d:x[1]})), az:L.az.map(x=>({n:x[0],d:x[1]})), leg:(L.leg||[]).map(x=>({n:x[0],d:x[1]})),
    sensi:"", lingue:"", size:""
  };
}
// stesso, per gli incantesimi del dizionario locale (chiavi: n, liv, sc, ct…)
function incantesimoLocaleADettaglio(s){
  return { nome:s.n, liv:s.liv, sc:s.sc, ct:s.ct, rg:s.rg, comp:s.comp, dur:s.dur,
           con:!!s.con, desc:s.desc, hl:s.hl || "", classi:"" };
}

/* ---------- 4.3 Budget XP e scontri bilanciati ---------- */
// budget = XP(livello) × nPG × moltiplicatore difficoltà (tabella DMG 5e)
function budgetXp(livello, pcs, diff){
  livello = clamp(Math.round(livello), 1, 20);
  pcs = clamp(Math.round(pcs), 1, 8);
  return Math.round(XP_LIV[livello-1] * pcs * MULT_DIFF[diff]);
}

// generatore di incontro: sceglie un "primato" adatto al budget e lo integra con mostri minori
function generaIncontro(livello, pcs, diff){
  const budget = budgetXp(livello, pcs, diff);
  let pool = state.mostri.filter(m => m.xp > 0 && m.xp <= budget*1.5 && crNum(m.cr) <= livello + 2 && crNum(m.cr) >= 0.25);
  if (pool.length < 4) pool = state.mostri.filter(m => m.xp > 0 && crNum(m.cr) <= livello + 3);
  if (!pool.length) pool = state.mostri.filter(m => m.xp > 0);
  // 1) mostro principale: tra i candidati "pesanti" (40% più costosi del pool) scegli in base a peso
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
    main = [...pool].sort((a,b)=>a.xp-b.xp)[0]; // budget minuscolo: il mostro più debole disponibile
  }
  const gruppi = new Map(); // nome → {m, qta, xp}
  const aggiungi = (m,qta)=>{
    const k = m.nome;
    if (gruppi.has(k)) gruppi.get(k).qta += qta;
    else gruppi.set(k, { m, qta, xp:m.xp*qta });
  };
  aggiungi(main, 1);
  let tot = main.xp;
  // 2) riempimento: mostri di supporto (CR più basso del primato) finché il budget non è vicino
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
  // 3) se il budget è ancora molto scoperto, prova a raddoppiare un mostro a caso già in lista
  if (tot < budget*0.5){
    const k = pick([...gruppi.keys()]);
    const g = gruppi.get(k);
    g.qta += 1; g.xp += g.m.xp; tot += g.m.xp;
  }
  const list = [...gruppi.values()].sort((a,b)=>b.m.cr-a.m.cr);
  return {
    budget, livello, pcs, diff,
    list: list.map(g=>({ nome:g.m.nome, cr:g.m.cr, xp:g.m.xp, qta:g.qta })),
    totale: tot,
    quota: tot/budget
  };
}
// etichetta di quanto l'incontro generato è vicino al budget
function etichettaQuota(quota){
  if (quota < 0.6) return "🟢 Ben più facile del target — adatto come riscaldamento";
  if (quota < 0.85) return "🟡 Leggermente sotto il target";
  if (quota <= 1.2) return " In linea col target";
  if (quota <= 1.5) return "🟠 Più pericoloso del target — i PG dovranno sudare";
  return "🔴 Molto sopra il target — scontro epico o mortale";
}

/* ---------- 4.4 Parser iniziativa: riconosce i tiri nella chat incollata ----------
   Formati gestiti:
     Fia [d20+4] 23            → nome + formula + totale
     Orco: 12                  → nome : totale
     Goblin 8                  → nome totale
     23 - Fia                   → totale - nome
     17 Kael (initiative)      → totale nome (initiative)
*/
function parseIniziativa(testo){
  const out = [];
  const viste = new Set();
  const linee = String(testo||"").split(/\r?\n/);
  for (const raw of linee){
    const riga = raw.trim();
    if (!riga || riga.length > 120) continue;
    let m, nome, val;
    // 1) "Nome [d20+3] 17" / "Roll: Nome [1d20 + 4] = 23" / "Nome: [1d20+3] 17"
    if ((m = riga.match(/^(.{2,40}?)\s*[:\-–]?\s*\[?\s*(?:1d20|d20)\s*([+-]\s*\d+)?\s*\]?\s*=?\s*(\d{1,2})\b/i))){
      nome = m[1].replace(/[:\-–]\s*$/, "").trim();
      val = +m[3];
    }
    // 2) "23 - Fia" / "23 - Fia [1d20+3]"
    else if ((m = riga.match(/^(\d{1,2})\s*[-–—]\s*(.{2,40})$/))){
      val = +m[1]; nome = m[2].replace(/\s*\[.*$/, "").trim();
    }
    // 3) "17 Kael (initiative)" / "17 Kael"
    else if ((m = riga.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ'’][\w'’ .\-]{1,39})/))) {
      val = +m[1]; nome = m[2].replace(/\s*\(.*/,"").replace(/\s+(iniziat|initiative).*$/i,"").trim();
    }
    // 4) "Nome: 12 (iniziativa)" / "Nome: 12"
    else if ((m = riga.match(/^(.{2,40}?)\s*[:\-–]\s*(\d{1,2})\s*(?:\(.*\))?(?:\s*(iniziat|initiative))?/i))){
      nome = m[1].trim(); val = +m[2];
    }
    // 5) "Nome 8" (ultima riga semplice: nome + numero)
    else if ((m = riga.match(/^(.{2,40}?)\s(\d{1,2})$/))){
      nome = m[1].trim(); val = +m[2];
    }
    if (nome && val != null && val >= 0 && val <= 30){
      nome = nome.replace(/^["“]|["”]$/g,"").trim();
      // pulisce prefissi tipo "Roll:" / "Roll:" lasciati dal formato Roll20
      nome = nome.replace(/^(roll|iniziativ?|initiative)\s*[:\-–]\s*/i, "").trim();
      if (nome && !/^(round|rounds|turn|turno|iniziat|initiative|roll|d20|total)$/i.test(nome)){
        const chiave = nome.toLowerCase();
        if (!viste.has(chiave)){ viste.add(chiave); out.push({nome, init:val}); }
      }
    }
  }
  return out;
}

/* ---------- 4.5 Generatore PNG procedurale ---------- */
function generaPNGProc(){
  const fem = Math.random() < 0.5;
  const nome = pick(fem ? NOMI_F : NOMI_M) + " " + pick(COGNOMI);
  const razza = pick(RAZZE_NPC);
  const eta = rnd(18, 74);
  const aspetto = pick(CORPI_NPC) + ", " + pick(DETTAGLI_NPC);
  return [
    "NOME: " + nome,
    "RAZZA E RUOLO: " + razza,
    "ETÀ E ASPETTO: " + eta + " anni; " + aspetto + ".",
    "TRATTO CARATTERIALE: " + pick(TRATTI_NPC),
    "IDEALE E COLLEGAMENTO: " + pick(IDEALI_NPC),
    "SEGRETO: " + pick(SEGRETI_NPC),
    "AGGANCIO ALLA TRAMA: " + pick(AGGIANCI_NPC),
    "FRASE ICONICA: \"" + pick(FRASI_NPC) + "\""
  ].join("\n");
}

/* ---------- 4.6 Meteo & imprevisti ---------- */
function generaEventoProc(idBioma){
  const b = L_BIOMI[idBioma];
  return { meteo: pick(b.meteo), evento: pick(b.eventi) };
}

/* ---------- 4.7 Bottino ---------- */
function tiriDadi(dadi){ // "3d6" → somma
  const m = String(dadi).match(/(\d+)d(\d+)/i);
  if (!m) return 0;
  const n = +m[1], facce = +m[2];
  let s = 0;
  for (let i=0;i<n;i++) s += 1 + Math.floor(Math.random()*facce);
  return s;
}
function generaBottino(fascia){
  const monete = LOOT_MONETE[fascia].map(([d,mon])=>({ val:tiriDadi(d), mon }));
  const d20 = rnd(1,20);
  const oggetti = [];
  const prende = (tier, n)=>{
    for (let i=0;i<n;i++) oggetti.push({ nome:pick(LOOT_TIERS[tier]), tier });
  };
  if (fascia === "0-4"){ if (d20 >= 12) prende("comune",1); }
  else if (fascia === "5-10"){ if (d20 <= 8) prende("comune",1); else if (d20 <= 14) prende("noncomune",1); else { prende("noncomune",1); prende("comune",1); } }
  else if (fascia === "11-16"){ if (d20 <= 6) prende("noncomune",1); else if (d20 <= 12) prende("noncomune",2); else if (d20 <= 16) prende("raro",1); else { prende("raro",1); prende("noncomune",1); } }
  else { if (d20 <= 8) prende("raro",1); else if (d20 <= 14){ prende("raro",1); prende("noncomune",1); } else prende("raro",2); }
  // valore stimato in gp
  let gp = 0;
  for (const m of monete) gp += m.val * LOOT_VALORI[m.mon];
  for (const o of oggetti) gp += LOOT_VAL_TIERS[o.tier];
  const TIER_NOME = { comune:"Comune", noncomune:"Non Comune", raro:"Raro" };
  return { monete, oggetti, gp:Math.round(gp), TIER_NOME };
}

/* ---------- 4.8 Cliente LLM ---------- */
function getLLM(){
  try{ return JSON.parse(localStorage.getItem("adm_llm") || "null") || {}; }catch(e){ return {}; }
}
function llmConfigurato(){
  const s = getLLM();
  return !!(s.provider && s.provider !== "nessuno" && s.key);
}
function chatLLM(sys, user){
  const s = getLLM();
  if (!s.provider || s.provider === "nessuno" || !s.key)
    return Promise.reject(new Error("LLM non configurato: aggiungi la chiave nella scheda Impostazioni."));
  const model = s.model || LLM_DEFAULT_MODEL[s.provider];
  let url, headers = { "Content-Type":"application/json" };
  const body = { model, temperature:0.9, max_tokens:700,
    messages:[{role:"system",content:sys},{role:"user",content:user}] };
  if (s.provider === "openrouter"){
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers.Authorization = "Bearer " + s.key;
    headers["HTTP-Referer"] = location.origin || "https://assistente-dm.local";
    headers["X-Title"] = "AssistenteDM";
  } else if (s.provider === "groq"){
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers.Authorization = "Bearer " + s.key;
  } else if (s.provider === "huggingface"){
    url = "https://api-inference.huggingface.co/models/" + encodeURIComponent(model) + "/v1/chat/completions";
    headers.Authorization = "Bearer " + s.key;
  } else {
    return Promise.reject(new Error("Provider sconosciuto."));
  }
  return fetchJSONRaw(url, body, headers);
}
function fetchJSONRaw(url, body, headers){
  return new Promise((resolve,reject)=>{
    const c = new AbortController();
    const t = setTimeout(()=>{ c.abort(); reject(new Error("timeout: il modello impiega troppo o la chiave non è valida")); }, 30000);
    fetch(url, { method:"POST", headers, body:JSON.stringify(body), signal:c.signal })
      .then(async r=>{
        let j; try{ j = await r.json(); }catch(e){ j = {}; }
        if (!r.ok){
          const msg = (j && (j.error?.message || j.message || j.detail)) || ("Errore HTTP " + r.status);
          reject(new Error(typeof msg === "string" ? msg : JSON.stringify(msg)));
          return;
        }
        const txt = j?.choices?.[0]?.message?.content;
        if (!txt) reject(new Error("Risposta vuota dal modello."));
        else resolve(txt.trim());
      })
      .catch(e=>{ clearTimeout(t); reject(e); });
  });
}
const PROMPT_SYS_NPC = "Sei un creativo di campagne per Dungeons & Dragons 5e, specializzato in personaggi non giocanti memorabili e coerenti con l'ambientazione del master. Rispondi SEMPRE in italiano e SOLO con la scheda richiesta, in questo formato esatto (una riga per campo):\nNOME: ...\nRAZZA E RUOLO: ...\nETÀ E ASPETTO: ...\nTRATTO CARATTERIALE: ...\nIDEALE E COLLEGAMENTO: ...\nSEGRETO: ...\nAGGANCIO ALLA TRAMA: ...\nFRASE ICONICA: \"...\"";
const PROMPT_SYS_EVENT = "Sei un master di D&D 5e. Rispondi SEMPRE in italiano e SOLO con un evento, in questo formato esatto (una riga per campo):\nMETEO: ...\nIMPREVVISTO: ...\nDETTAGLI: ...";
