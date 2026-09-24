/* ============================================================
   5) INTERFACCIA — collegamenti tra il motore e la pagina
   ============================================================ */

/* ---------- 5.1 Infrastruttura UI ---------- */
const $ = id => document.getElementById(id);
let toastTimer = null;
function toast(msg, tipo){
  const t = $("toast");
  t.textContent = msg;
  t.className = "show " + (tipo || "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.className = ""; }, 2800);
}
function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
// etichetta colorata (usa le classi .tag del CSS)
function tag(t, cls){ return `<span class="tag ${cls||""}">${esc(t)}</span>`; }
// debounce: esegue fn solo dopo `ms` di silenzio (per le ricerche)
function debounce(fn, ms){
  let t;
  return function(...a){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,a), ms); };
}
// Stato di caricamento sul bottone: lo disabilita e mostra uno spinner,
// così l'utente non clicca due volte pensando che l'app sia bloccata.
// `fn` può essere sincrono o asincrono; il bottone si sblocca da solo a fine azione.
function conLoading(b, fn, label){
  if (!b || b.disabled) return; // già in caricamento: ignora il doppio click
  const orig = b.innerHTML;
  b.disabled = true;
  b.innerHTML = '<span class="spin"></span> ' + esc(label || "In corso…");
  let chiuso = false;
  const fine = ()=>{
    if (chiuso) return;
    chiuso = true;
    b.disabled = false;
    b.innerHTML = orig;
  };
  return Promise.resolve().then(fn)
    .catch(e=>{
      console.error("Azione interrotta:", e);
      mostraGlobalErr("Azione interrotta (" + (e?.message || "errore inatteso") + ")");
    })
    .finally(fine);
}
// Rete di sicurezza: un errore inatteso NON deve mai lasciare la pagina bianca
// o bloccata — mostra un banner in alto, l'app resta pienamente usabile.
function mostraGlobalErr(msg){
  const g = $("globalErr");
  if (!g) return;
  g.textContent = "⚠️ " + msg + " — L'app resta usabile: puoi riprovare.";
  g.classList.add("show");
  clearTimeout(mostraGlobalErr.t);
  mostraGlobalErr.t = setTimeout(()=>g.classList.remove("show"), 9000);
}

/* ---------- 5.2 Schede (tab) ---------- */
function attivaTab(id){
  document.querySelectorAll("section.tab").forEach(s=>s.classList.toggle("active", s.id === "tab-"+id));
  document.querySelectorAll("nav.tabs button").forEach(b=>b.classList.toggle("active", b.dataset.tab === id));
}
document.querySelectorAll("nav.tabs button").forEach(b=>{
  b.addEventListener("click", ()=>attivaTab(b.dataset.tab));
});

/* ---------- 5.3 Stato API (chip in alto) ---------- */
function aggiornaChipApi(){
  const chip = $("apiStatus"), lab = $("srcLabel");
  if (state.fonteApi){
    chip.textContent = "🟢 Fonte: " + state.fonte;
    chip.className = "chip ok";
  } else {
    chip.textContent = "⚠️ Errore di connessione: uso i dati locali";
    chip.className = "chip err";
  }
  if (lab) lab.textContent = state.fonte;
}

/* ---------- 5.4 Ricerca mostri ---------- */
// precalcola i nomi già normalizzati (una volta per fonte dati, non a ogni tasto):
// la ricerca durante la digitazione resta fluida anche con 300+ mostri
function preparaCerca(){
  state.mostri.forEach(m=>{ m._l = norma(m.nome); });
  state.incantesimi.forEach(s=>{ s._l = norma(s.nome + " " + (s.localeNome || "")); });
}
function trovaMostri(q){
  q = norma(q);
  if (!q) return state.mostri;
  return state.mostri.filter(m=>(m._l || norma(m.nome)).includes(q));
}
function renderMostri(lista){
  const box = $("monResults");
  $("monCount").textContent = state.mostri.length + " mostri";
  const vis = lista.slice(0, 30);
  if (!vis.length){ box.innerHTML = '<div class="empty">Nessun mostro trovato. Prova con un altro nome (es. "drago", "goblin").</div>'; return; }
  box.innerHTML = vis.map((m,i)=>`
    <div class="res-item" data-i="${i}">
      <span class="ri-nome">${esc(m.nome)}</span>
      <span class="ri-cr">${m.cr == null ? "CR —" : "CR " + esc(crLabel(m.cr))}</span>
      <span class="ri-xp">${m.xp == null ? "Apri la scheda" : esc(m.xp) + " XP"}</span>
    </div>`).join("");
  box.querySelectorAll(".res-item").forEach(el=>{
    el.addEventListener("click", ()=>apriMostro(vis[+el.dataset.i]));
  });
}
// guardia contro le "corse": se clicchi due mostri in rapida successione,
// la scheda che si apre è sempre quella dell'ultimo click
let monDetSeq = 0;
async function apriMostro(m){
  const seq = ++monDetSeq;
  const det = $("monDetail");
  det.style.display = "block";
  det.innerHTML = '<div class="empty"><span class="spin"></span> Caricamento scheda…</div>';
  let d = await dettaglioMostro(m);
  if (seq !== monDetSeq) return; // arrivati in ritardo: un click più recente ha la precedenza
  if (!d || !d.nome){ det.innerHTML = '<div class="empty">Scheda non disponibile per ora (API offline).</div>'; return; }
  const AB_LAB = ["For","Des","Cos","Int","Sag","Car"];
  const abHtml = d.ab && d.ab.length ? `<div class="stat-grid">` + d.ab.map((v,i)=>`<div class="stat"><div class="s-val">${esc(v ?? "—")}</div><div class="s-lab">${AB_LAB[i]}</div></div>`).join("") + `</div>` : "";
  const azHtml = (d.az||[]).map(a=>`<div class="azione"><b>${esc(a.n)}</b>${a.d?`<p>${esc(a.d)}</p>`:""}</div>`).join("");
  const traHtml = (d.tra||[]).map(a=>`<div class="azione" style="border-left-color:var(--oroScuro)"><b>${esc(a.n)}</b>${a.d?`<p>${esc(a.d)}</p>`:""}</div>`).join("");
  const legHtml = (d.leg||[]).map(a=>`<div class="azione" style="border-left-color:var(--oro)"><b>⭐ ${esc(a.n)}</b>${a.d?`<p>${esc(a.d)}</p>`:""}</div>`).join("");
  det.innerHTML = `
    <h2>📜 ${esc(d.nome)}</h2>
    <div>
      ${tag(d.t)} ${tag("CR " + crLabel(d.cr), "gold")} ${tag(d.xp + " XP", "gold")}
      ${d.allineamento ? tag(d.allineamento) : ""} ${d.size ? tag(d.size) : ""}
    </div>
    <div class="stat-grid" style="margin-top:14px">
      <div class="stat"><div class="s-val">${esc(d.ca ?? "—")}</div><div class="s-lab">Classe Arma (CA)</div></div>
      <div class="stat"><div class="s-val">${d.pv != null ? esc(d.pv) : "—"}</div><div class="s-lab">Punti Ferita ${d.tiri ? "· " + esc(d.tiri) : ""}</div></div>
      <div class="stat"><div class="s-val" style="font-size:14px;padding-top:6px">${esc(d.vel || "—")}</div><div class="s-lab">Velocità</div></div>
    </div>
    ${abHtml}
    ${d.sensi || d.lingue ? `<p class="hint">👁 ${esc(d.sensi)}${d.sensi && d.lingue ? " · " : ""}🗣 ${esc(d.lingue)}</p>` : ""}
    ${(d.sal && d.sal.length) ? `<p class="hint">🛡 Salvezze provette: ${d.sal.map(esc).join(", ")}</p>` : ""}
    ${(d.vul && d.vul.length) || (d.res && d.res.length) || (d.imm && d.imm.length) ? `
      <h3>Vulnerabilità / Resistenze / Immunità</h3>
      <div>${(d.vul||[]).map(v=>tag("Vulnerabile: "+v)).join("")}${(d.res||[]).map(v=>tag("Resistente: "+v,"gold")).join("")}${(d.imm||[]).map(v=>tag("Immune: "+v)).join("")}</div>` : ""}
    ${traHtml ? `<h3>Tratti speciali</h3>${traHtml}` : ""}
    ${azHtml ? `<h3>Azioni</h3>${azHtml}` : ""}
    ${legHtml ? `<h3>Azioni leggendarie</h3>${legHtml}` : ""}
    <p class="hint" style="margin-top:10px">Fonte: ${esc(state.fonte)} · Licenza OGL 1.0a (SRD 5.1)</p>`;
  det.scrollIntoView({behavior:"smooth", block:"nearest"});
}

/* ---------- 5.5 Ricerca incantesimi ---------- */
function trovaIncantesimi(q){
  q = norma(q);
  if (!q) return state.incantesimi;
  return state.incantesimi.filter(s => (s._l || norma(s.nome)).includes(q));
}
function renderIncantesimi(lista){
  const box = $("spellResults");
  $("spellCount").textContent = state.incantesimi.length + " incantesimi";
  const vis = lista.slice(0, 30);
  if (!vis.length){ box.innerHTML = '<div class="empty">Nessun incantesimo trovato.</div>'; return; }
  box.innerHTML = vis.map((s,i)=>`
    <div class="res-item" data-i="${i}">
      <span class="ri-nome">${esc(s.nome)}</span>
      <span class="ri-cr">Livello ${s.liv ?? 0}</span>
    </div>`).join("");
  box.querySelectorAll(".res-item").forEach(el=>{
    el.addEventListener("click", ()=>apriIncantesimo(vis[+el.dataset.i]));
  });
}
let spellDetSeq = 0;
async function apriIncantesimo(s){
  const seq = ++spellDetSeq;
  const det = $("spellDetail");
  det.style.display = "block";
  det.innerHTML = '<div class="empty"><span class="spin"></span> Caricamento scheda…</div>';
  let d = await dettaglioIncantesimo(s);
  if (seq !== spellDetSeq) return; // risposta in ritardo: un click più recente ha la precedenza
  if (!d || !d.nome){ det.innerHTML = '<div class="empty">Scheda non disponibile per ora (API offline).</div>'; return; }
  const L = d.liv === 0 ? "Incantesimo minore" : d.liv === 9 ? "9° livello" : d.liv + "° livello";
  det.innerHTML = `
    <h2>✨ ${esc(d.nome)}</h2>
    <div>${tag(d.sc)} ${tag(L,"gold")} ${d.con ? tag("Concentrazione") : ""}</div>
    <table class="tbl">
      <tr><th>Tempo di lancio</th><td>${esc(d.ct || "—")}</td></tr>
      <tr><th>Portata</th><td>${esc(d.rg || "—")}</td></tr>
      <tr><th>Componenti</th><td>${esc(d.comp || "—")}</td></tr>
      <tr><th>Durata</th><td>${esc(d.dur || "—")}</td></tr>
      ${d.classi ? `<tr><th>Classi</th><td>${esc(d.classi)}</td></tr>` : ""}
    </table>
    <h3>Descrizione</h3>
    <div class="result-box" style="margin-top:8px">${esc(d.desc || "—")}</div>
    ${d.hl ? `<h3>Livelli superiori</h3><div class="result-box" style="margin-top:8px">${esc(d.hl)}</div>` : ""}
    <p class="hint" style="margin-top:10px">Fonte: ${esc(state.fonte)} · Licenza OGL 1.0a (SRD 5.1)</p>`;
  det.scrollIntoView({behavior:"smooth", block:"nearest"});
}

/* ---------- 5.6 Scontri: budget + generatore ---------- */
function parametriScontro(){
  return {
    pcs: clamp(+$("encPC").value || 4, 1, 8),
    liv: clamp(+$("encLvl").value || 5, 1, 20),
    diff: $("encDiff").value
  };
}
function aggiornaTabellaBudget(){
  const {pcs, liv, diff} = parametriScontro();
  const tb = $("encTable").querySelector("tbody");
  tb.innerHTML = Object.keys(NOME_DIFF).map(d=>{
    const att = d === diff;
    return `<tr style="${att?"background:rgba(212,175,55,.08)":""}">
      <td>${ICONE_DIFF[d]} ${NOME_DIFF[d]}${att ? " ◀" : ""}</td>
      <td class="num"><b>${budgetXp(liv, pcs, d).toLocaleString("it-IT")}</b></td></tr>`;
  }).join("");
}
function generaScontro(){
  const p = parametriScontro();
  const res = generaIncontro(p.liv, p.pcs, p.diff);
  memoria.setItem("adm_ultimoIncontro", JSON.stringify(res));
  const righe = res.list.map(g=>`${g.qta > 1 ? g.qta + " × " : ""}${g.nome}  —  CR ${crLabel(g.cr)}, ${g.xp} XP`).join("\n");
  const testo = `⚔️ INCONTRO — ${res.pcs} PG di livello ${res.livello} (${NOME_DIFF[res.diff]})\n` +
    `Budget: ${res.budget} XP\n\n${righe}\n\nTotale: ${res.totale} XP (${Math.round(res.quota*100)}% del budget)\n${etichettaQuota(res.quota)}`;
  $("encResult").innerHTML = `
    <div class="result-box">
      <div class="rb-titolo">⚔️ Incontro generato — ${NOME_DIFF[res.diff]}</div>
      Budget: <b>${res.budget} XP</b> · ${res.pcs} PG · livello ${res.livello}\n\n${esc(righe)}\n
      <span style="color:var(--muto)">Totale: ${res.totale} XP (${Math.round(res.quota*100)}% del budget) — ${esc(etichettaQuota(res.quota))}</span>
      <div class="rb-copia"><button class="btn small" id="btnCopyEnc">📋 Copia incontro</button></div>
    </div>`;
  $("btnCopyEnc").addEventListener("click", async ()=>{ await copiaTesto(testo); toast("Incontro copiato negli appunti", "ok"); });
  toast("Incontro generato!", "ok");
}

/* ---------- 5.7 Iniziativa ---------- */
let init = (()=>{ try{ return JSON.parse(memoria.getItem("adm_iniziativa")||"{}"); }catch(e){ return {}; } })();
if (!init || typeof init !== "object") init = {};
init.lista = Array.isArray(init.lista)
  ? init.lista.filter(x=>x && typeof x.nome==="string" && Number.isFinite(+x.init))
      .map(x=>({nome:x.nome,init:+x.init})) : [];
if (!Number.isInteger(init.indice) || init.indice >= init.lista.length) init.indice = -1;
if (!Number.isInteger(init.round) || init.round < 0) init.round = 0;
function salvaInit(){ memoria.setItem("adm_iniziativa", JSON.stringify(init)); }
function aggiungiCombattente(nome, val){
  nome = String(nome||"").trim();
  if (!nome) { toast("Inserisci un nome", "err"); return; }
  if (val == null || val === "" || !Number.isFinite(+val)) { toast("Inserisci il valore del tiro", "err"); return; }
  val = clamp(+val, 0, 30);
  const es = init.lista.find(x=>x.nome.toLowerCase() === nome.toLowerCase());
  if (es) es.init = val; else init.lista.push({nome, init:val});
  init.indice = -1;
  renderInit();
}
function renderInit(){
  const lista = [...init.lista].sort((a,b)=>b.init - a.init);
  init.lista = lista;
  const ol = $("initList");
  if (!lista.length){
    ol.innerHTML = '<div class="empty">Nessun combattente. Aggiungili qui sotto o incolla la chat di Roll20.</div>';
    $("turnoBanner").style.display = "none";
    salvaInit(); return;
  }
  ol.innerHTML = lista.map((c,i)=>{
    const cur = i === init.indice;
    const done = init.indice >= 0 && i > init.indice;
    return `<li class="init-item ${cur?"current":""} ${done?"done":""}" data-i="${i}">
      <span class="pos">${i+1}</span>
      <span class="i-nome">${esc(c.nome)}</span>
      <span class="i-val">${c.init}</span>
      <button class="i-rm" data-rm="${i}" title="Rimuovi">✕</button>
    </li>`;
  }).join("");
  const cur = lista[init.indice];
  const banner = $("turnoBanner");
  if (cur){
    init.round = init.round || 1;
    banner.style.display = "block";
    banner.innerHTML = `Round ${init.round} — Turno di <b style="color:var(--oro)">${esc(cur.nome)}</b> (iniziativa ${cur.init})`;
  } else {
    banner.style.display = "none";
  }
  ol.querySelectorAll(".init-item").forEach(el=>{
    el.addEventListener("click", e=>{
      if (e.target.dataset.rm != null){
        const i = +e.target.dataset.rm;
        init.lista.splice(i,1);
        init.indice = -1;
        renderInit(); return;
      }
      init.indice = +el.dataset.i;
      renderInit();
    });
  });
  salvaInit();
}
function avanzaTurno(){
  if (!init.lista.length){ toast("Aggiungi prima i combattenti", "err"); return; }
  if (init.indice < 0){ init.indice = 0; init.round = 1; }
  else if (init.indice + 1 >= init.lista.length){ init.indice = 0; init.round++; }
  else init.indice++;
  renderInit();
}
function estraiIniziativaDaTesto(){
  const testo = $("initPaste").value;
  const trovat = parseIniziativa(testo);
  if (!trovat.length){ toast("Nessun tiro riconosciuto nel testo", "err"); return; }
  let aggiunti = 0;
  for (const c of trovat){
    const es = init.lista.find(x=>x.nome.toLowerCase() === c.nome.toLowerCase());
    if (es){ if (es.init !== c.init){ es.init = c.init; aggiunti++; } }
    else { init.lista.push(c); aggiunti++; }
  }
  init.indice = -1;
  renderInit();
  toast(aggiunti + " combattenti aggiunti/aggiornati", "ok");
}

/* ---------- 5.8 PNG & Eventi ---------- */
function boxRisultato(html, testoPulito, idContenitore, avviso = ""){
  $(idContenitore).innerHTML = `
    ${avviso ? `<p class="hint" style="color:var(--err)" role="alert">⚠️ ${esc(avviso)}</p>` : ""}
    <div class="result-box">
      <div class="rb-titolo"></div>
      ${html}
      <div class="rb-copia"><button class="btn small" id="btnCopy${idContenitore}">📋 Copia</button></div>
    </div>`;
  $("btnCopy"+idContenitore).addEventListener("click", async ()=>{ await copiaTesto(testoPulito); toast("Copiato negli appunti", "ok"); });
}
async function generaNPC(){
  const amb = $("npSetting").value.trim();
  const usaLLM = $("npLLM").checked && llmConfigurato();
  const box = $("npResult");
  box.innerHTML = '<div class="empty"><span class="spin"></span> Creazione del PNG…</div>';
  try{
    let testo;
    if (usaLLM){
      const user = `Ambientazione di campagna: "${amb || "non specificata"}"\n\n` +
        "Crea un PNG secondario ma memorabile (mercante, guardia, prete, stregone, ex-avventuriero, spionessa, capo villaggio, creatura parzialmente razionale…), coerente con l'ambientazione. " +
        "Il segreto deve poter generare un arco narrativo; l'aggancio deve dare ai PG un motivo concreto per cercare questo PNG.";
      testo = await chatLLM(PROMPT_SYS_NPC, user);
    } else {
      testo = generaPNGProc();
      if (amb) testo += "\n\n(Ambientazione di riferimento: " + amb + ")";
    }
    boxRisultato(esc(testo), testo, "npResult", $("npLLM").checked && !usaLLM ? "Chiave LLM non configurata: genero con i dati locali. Per attivarla, vai in Impostazioni." : "");
    $("npResult").querySelector(".rb-titolo").textContent = "🎭 " + (usaLLM ? "PNG generato con LLM" : "PNG generato (procedurale)");
  }catch(e){
    if (usaLLM){
      const testo = generaPNGProc() + (amb ? "\n\n(Ambientazione di riferimento: " + amb + ")" : "");
      boxRisultato(esc(testo), testo, "npResult", "LLM non raggiungibile (" + e.message + "). Uso i dati locali.");
      $("npResult").querySelector(".rb-titolo").textContent = "🎭 PNG generato (procedurale, fallback)";
    } else {
      box.innerHTML = '<div class="empty">Errore: ' + esc(e.message) + "</div>";
    }
  }
}
async function generaEvento(){
  const idBioma = $("evBiome").value;
  const amb = $("npSetting").value.trim();
  const usaLLM = $("evLLM").checked && llmConfigurato();
  const box = $("evResult");
  box.innerHTML = '<div class="empty"><span class="spin"></span> Generazione…</div>';
  try{
    let testo;
    if (usaLLM){
      const user = `Bioma attuale: ${L_BIOMI[idBioma].nome}. Ambientazione: "${amb || "non specificata"}".\n\n` +
        "Genera un evento di viaggio / complicazione ambientale immediata. Tono evocativo, niente soluzioni facili, e nei DETTAGLI inserisci una possibile conseguenza meccanica D&D (tiro salvezza o check di abilità con DC).";
      testo = await chatLLM(PROMPT_SYS_EVENT, user);
    } else {
      const e = generaEventoProc(idBioma);
      testo = "METEO: " + e.meteo + "\nIMPREVVISTO: " + e.evento;
    }
    boxRisultato(esc(testo), testo, "evResult", $("evLLM").checked && !usaLLM ? "Chiave LLM non configurata: genero con i dati locali. Per attivarla, vai in Impostazioni." : "");
    $("evResult").querySelector(".rb-titolo").textContent = "🌩️ " + L_BIOMI[idBioma].icon + " " + L_BIOMI[idBioma].nome + (usaLLM ? " (LLM)" : "");
  }catch(e){
    if (usaLLM){
      const p = generaEventoProc(idBioma);
      const testo = "METEO: " + p.meteo + "\nIMPREVVISTO: " + p.evento;
      boxRisultato(esc(testo), testo, "evResult", "LLM non raggiungibile (" + e.message + "). Uso i dati locali.");
      $("evResult").querySelector(".rb-titolo").textContent = "🌩️ " + L_BIOMI[idBioma].icon + " " + L_BIOMI[idBioma].nome + " (procedurale, fallback)";
    } else {
      box.innerHTML = '<div class="empty">Errore: ' + esc(e.message) + "</div>";
    }
  }
}

/* ---------- 5.9 Bottino ---------- */
function generaLoot(){
  const fascia = $("lootCR").value;
  const b = generaBottino(fascia);
  const righeMon = b.monete.map(m=>`${m.val} ${LOOT_NOMI[m.mon]}`).join(" · ");
  const righeObj = b.oggetti.length
    ? b.oggetti.map(o=>"• " + o.nome + " (" + b.TIER_NOME[o.tier] + ")").join("\n")
    : "• Nessuna magia, solo monete e polvere";
  const testo = `💰 BOTTINO — CR ${fascia}\nMonete: ${righeMon}\nOggetti:\n${righeObj}\nValore stimato: ~${b.gp} gp`;
  $("lootResult").innerHTML = `
    <div class="result-box">
      <div class="rb-titolo">💰 Bottino — CR ${fascia}</div>
      <b>Monete:</b> ${esc(righeMon)}\n
      <b>Oggetti:</b>\n${esc(righeObj)}\n
      <span style="color:var(--muto)">Valore stimato: ~${b.gp} gp</span>
      <div class="rb-copia"><button class="btn small" id="btnCopyLoot">📋 Copia bottino</button></div>
    </div>`;
  $("btnCopyLoot").addEventListener("click", async ()=>{ await copiaTesto(testo); toast("Bottino copiato negli appunti", "ok"); });
}
function usaCRLultimoIncontro(){
  let u = null;
  try{ u = JSON.parse(memoria.getItem("adm_ultimoIncontro") || "null"); }catch(e){}
  if (!u || !u.list || !u.list.length){ toast("Genera prima un incontro nella scheda Scontri", "err"); return; }
  // il CR "dominante" dell'incontro è quello del mostro principale (il primo in lista)
  const cr = u.list[0].cr;
  const fascia = cr <= 4 ? "0-4" : cr <= 10 ? "5-10" : cr <= 16 ? "11-16" : "17+";
  $("lootCR").value = fascia;
  toast("CR dell'ultimo incontro: " + crLabel(cr) + " → fascia " + fascia, "ok");
}

/* ---------- 5.10 Impostazioni LLM ---------- */
function carregaSettings(){
  const s = getLLM();
  $("setProvider").value = s.provider || "nessuno";
  $("setKey").value = s.key || "";
  $("setModel").value = ""; // elimina residui di una selezione precedente
  aggiornaModelloWrap();
  $("llmStatus").textContent = s.key ? "🟢 Chiave salvata per " + s.provider : "Nessuna chiave salvata — l'app usa i sistemi procedurali.";
}
function aggiornaModelloWrap(){
  const p = $("setProvider").value;
  const wrap = $("modelWrap");
  if (p === "nessuno"){ wrap.style.display = "none"; return; }
  wrap.style.display = "block";
  $("setModel").placeholder = "Predefinito: " + LLM_DEFAULT_MODEL[p];
  carregaModelli();
}
// compila il menu a tendina con i modelli gratuiti ATTUALI (OpenRouter/Groq)
let modSeq = 0;
async function carregaModelli(){
  const seq = ++modSeq;
  const prov = $("setProvider").value;
  const sel = $("setModelSel");
  if (prov === "nessuno") return;
  if (prov === "huggingface"){
    sel.innerHTML = '<option value="__default__">⚡ Predefinito: ' + LLM_DEFAULT_MODEL[prov] + " (scrivi un altro modello nel campo sotto, se serve)</option>";
    return;
  }
  sel.innerHTML = '<option value="">⏳ Caricamento dell\'elenco modelli…</option>';
  try{
    const lista = await listaModelliFree(prov, $("setKey").value.trim());
    if (seq !== modSeq || prov !== $("setProvider").value) return; // ignora risposta vecchia
    if (!lista || !lista.length) throw new Error("lista vuota");
    const salvo = (getLLM().model || "").trim();
    let html = '<option value="__default__">⚡ ' + LLM_DEFAULT_MODEL[prov] + "</option>";
    for (const m of lista) html += '<option value="' + esc(m.id) + '">' + esc(m.nome) + "</option>";
    sel.innerHTML = html;
    if (salvo){
      if (lista.some(m=>m.id === salvo)) sel.value = salvo;
      else $("setModel").value = salvo; // modello salvato non più in elenco: resta nel campo personalizzato
    }
  }catch(e){
    if (seq !== modSeq || prov !== $("setProvider").value) return;
    sel.innerHTML = '<option value="__default__">⚠️ Elenco non caricato (offline?) — verrà usato il predefinito (' + LLM_DEFAULT_MODEL[prov] + ")</option>";
    const salvo = (getLLM().model || "").trim();
    if (salvo) $("setModel").value = salvo; // offline: non perdere il modello personalizzato
  }
}
function salvaSettings(){
  const custom = $("setModel").value.trim();
  const selVal = $("setModelSel").value;
  const s = {
    provider: $("setProvider").value,
    model: custom || (selVal && selVal !== "__default__" ? selVal : ""),
    key: $("setKey").value.trim()
  };
  memoria.setItem("adm_llm", JSON.stringify(s));
  $("llmStatus").textContent = s.provider !== "nessuno" && s.key ? "🟢 Salvo! Ora puoi spuntare 'Usa LLM' nelle schede PNG & Eventi." : "Impostazioni salvate.";
  toast("Impostazioni salvate", "ok");
}
async function testaLLM(){
  const keyTmp = $("setKey").value.trim();
  const provTmp = $("setProvider").value;
  if (provTmp === "nessuno"){ toast("Scegli prima un provider", "err"); return; }
  if (!keyTmp){ toast("Incolla prima la chiave API", "err"); return; }
  // Il test usa i campi della GUI senza salvare una chiave eventualmente errata.
  const selVal = $("setModelSel").value;
  const s = { provider:provTmp,
    model:$("setModel").value.trim() || (selVal && selVal !== "__default__" ? selVal : ""), key:keyTmp };
  $("llmStatus").innerHTML = '<span class="spin"></span> Test in corso…';
  try{
    await chatLLM("Sei un assistente di test. Rispondi solo: OK", "Di' OK.", s);
    $("llmStatus").innerHTML = "🟡 Connesso! Ora premi <b>Salva</b> per confermare definitivamente.";
    toast("Connessione LLM riuscita!", "ok");
  }catch(e){
    $("llmStatus").innerHTML = "🔴 Errore: " + esc(e.message);
    toast("Connessione fallita: " + e.message, "err");
  }
}
function rimuoviChiave(){
  memoria.removeItem("adm_llm");
  $("setKey").value = ""; $("setModel").value = "";
  $("llmStatus").textContent = "Chiave rimossa.";
  toast("Chiave rimossa dal browser", "ok");
}

/* ---------- 5.11 Avvio ---------- */
function avvio(){
  // Verifica reale della persistenza: se non disponibile, resta tutto usabile
  // con dati temporanei, ma l'utente viene avvisato in modo permanente.
  try{
    localStorage.setItem("__adm_test__", "1"); localStorage.removeItem("__adm_test__");
  }catch(e){ $("storageWarning").style.display = "block"; }
  // tab navigabili
  // ricerca mostri e incantesimi (debounce: la digitazione resta fluida)
  const cercaMon = debounce(()=>renderMostri(trovaMostri($("mqMon").value)), 200);
  $("mqMon").addEventListener("input", ()=>{
    $("monCount").innerHTML = '<span class="spin"></span> Ricerca…';
    cercaMon();
  });
  $("mqSpell").addEventListener("input", debounce(()=>renderIncantesimi(trovaIncantesimi($("mqSpell").value)), 200));
  // scontri
  ["encPC","encLvl","encDiff"].forEach(id=>$(id).addEventListener("input", aggiornaTabellaBudget));
  $("btnEncounter").addEventListener("click", generaScontro);
  // iniziativa
  $("btnInitAdd").addEventListener("click", ()=>{ aggiungiCombattente($("initName").value, $("initVal").value); $("initName").value=""; $("initVal").value=""; });
  $("initName").addEventListener("keydown", e=>{ if (e.key === "Enter") $("btnInitAdd").click(); });
  $("initVal").addEventListener("keydown", e=>{ if (e.key === "Enter") $("btnInitAdd").click(); });
  $("btnInitParse").addEventListener("click", estraiIniziativaDaTesto);
  $("btnInitAdvance").addEventListener("click", avanzaTurno);
  $("btnInitClear").addEventListener("click", ()=>{ init.lista = []; init.indice = -1; init.round = 0; renderInit(); toast("Iniziativa svuotata", "ok"); });
  // PNG & eventi (con stato di caricamento visibile sul bottone)
  const selBiome = $("evBiome");
  selBiome.innerHTML = Object.keys(L_BIOMI).map(k=>`<option value="${k}">${L_BIOMI[k].icon} ${L_BIOMI[k].nome}</option>`).join("");
  const biomaSalvo = memoria.getItem("adm_biome");
  if (biomaSalvo && L_BIOMI[biomaSalvo]) selBiome.value = biomaSalvo;
  selBiome.addEventListener("change", ()=>memoria.setItem("adm_biome", selBiome.value));
  $("btnNPC").addEventListener("click", ()=>conLoading($("btnNPC"), generaNPC, "Generazione in corso…"));
  $("btnEvent").addEventListener("click", ()=>conLoading($("btnEvent"), generaEvento, "Generazione in corso…"));
  // l'ambientazione si salva da sola mentre scrivi: se chiudi la pagina la ritrovi uguale
  $("npSetting").value = memoria.getItem("adm_ambientazione") || "";
  // Salvataggio sincrono (stringhe corte): persiste anche se chiudi subito dopo aver scritto.
  $("npSetting").addEventListener("input", ()=>memoria.setItem("adm_ambientazione", $("npSetting").value));
  // bottino
  $("btnLoot").addEventListener("click", generaLoot);
  $("btnLootCR").addEventListener("click", usaCRLultimoIncontro);
  // impostazioni
  $("setProvider").addEventListener("change", ()=>{ $("setModel").value=""; aggiornaModelloWrap(); });
  // Una scelta esplicita dal menu sostituisce il precedente modello personalizzato.
  $("setModelSel").addEventListener("change", ()=>{ $("setModel").value=""; });
  $("btnModelReload").addEventListener("click", ()=>conLoading($("btnModelReload"), carregaModelli, "Caricamento…"));
  $("btnLLMSave").addEventListener("click", salvaSettings);
  $("btnLLMTest").addEventListener("click", ()=>conLoading($("btnLLMTest"), testaLLM, "Test in corso…"));
  $("btnLLMClear").addEventListener("click", rimuoviChiave);
  $("btnKeyEye").addEventListener("click", ()=>{ const k=$("setKey"); k.type = k.type === "password" ? "text" : "password"; });
  $("btnReset").addEventListener("click", ()=>{
    if (!confirm("Sei sicuro? Verranno cancellati la chiave LLM, l'ambientazione, l'iniziativa e tutti i dati salvati nel browser.")) return;
    ["adm_llm","adm_iniziativa","adm_ultimoIncontro","adm_biome","adm_ambientazione"].forEach(k=>memoria.removeItem(k));
    init = {lista:[], indice:-1, round:0};
    $("npSetting").value = "";
    $("setKey").value = ""; $("setModel").value = "";
    carregaSettings(); // svuota anche i campi visibili (non solo localStorage)
    $("evBiome").value = "foresta";
    toast("Tutti i dati locali azzerati", "ok");
    renderInit();
  });
  // rete di sicurezza: nessun errore inatteso deve mai bloccare la pagina o lasciarla bianca
  window.addEventListener("unhandledrejection", e=>{
    const msg = (e.reason && (e.reason.message || String(e.reason))) || "errore imprevisto";
    console.error("Operazione interrotta:", e.reason);
    mostraGlobalErr("Qualcosa non ha funzionato (" + msg + ")");
  });
  window.addEventListener("error", e=>{
    // gli errori di caricamento di risorse (font, immagini) sono normali quando sei offline: li ignora
    if (!e.message || /resource|net::|favicon|css|font/i.test(e.message)) return;
    console.error(e.error || e.message);
    mostraGlobalErr(e.message || "Errore interno");
  });
  // prime renderizzazioni (con dati locali già disponibili: l'app è subito usabile)
  preparaCerca();
  renderMostri(state.mostri);
  renderIncantesimi(state.incantesimi);
  aggiornaTabellaBudget();
  renderInit();
  carregaSettings();
  // poi prova a collegarsi all'API (l'app nel frattempo resta pienamente usabile).
  // La chip in alto resta "⏳ Caricamento…" finché non c'è un esito.
  caricaDatiApi((cosa)=>{
    aggiornaChipApi();
    if (cosa === "monsters"){ renderMostri(trovaMostri($("mqMon").value)); toast("🟢 Collegato all'API SRD: " + state.fonte, "ok"); }
    if (cosa === "spells") renderIncantesimi(trovaIncantesimi($("mqSpell").value));
  }).then(res=>{
    aggiornaChipApi();
    if (!res.okMon) toast("⚠️ Errore di connessione all'API mostri: uso i dati locali incorporati", "err");
    if (!res.okSpell) toast("⚠️ Errore di connessione all'API incantesimi: uso i dati locali", "err");
  }).catch(()=>{
    aggiornaChipApi();
    toast("⚠️ Errore di connessione: uso i dati locali incorporati", "err");
  });
}
avvio();
