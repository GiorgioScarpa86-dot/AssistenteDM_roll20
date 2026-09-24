/* ============================================================
   COSTRUZIONE DEL PANNELLO FLUTTUANTE + LOGICA UI
   ============================================================ */
const P = document.createElement("div");
P.id = "adm-panel";
P.innerHTML = `
  <div class="adm-head" id="adm-drag">
    <b>⚔️ Assistente DM</b>
    <button id="adm-min" title="Minimizza/espandi">—</button>
    <button id="adm-close" title="Chiudi (riapri dal menu Tampermonkey)">✕</button>
  </div>
  <div class="adm-tabs" id="adm-tabs">
    <button data-t="init" class="adm-on">🎲 Iniziativa</button>
    <button data-t="enc">⚔️ Scontri</button>
    <button data-t="npc">🎭 PNG</button>
    <button data-t="loot">💰 Bottino</button>
    <button data-t="ev">🌩️ Eventi</button>
    <button data-t="set">⚙️</button>
  </div>
  <div class="adm-body">
    <div class="adm-tabpage on" id="pg-init">
      <div class="adm-istato">👀 <b>Chat monitorata</b> — i tiri d20 con "iniziativa" vengono aggiunti da soli</div>
      <div class="adm-banner" id="adm-banner" style="display:none">—</div>
      <ol class="adm-init" id="adm-initlist"></ol>
      <div class="adm-row">
        <button class="adm-btn gold" id="adm-avanza">▶ Avanza Turno</button>
        <button class="adm-btn danger" id="adm-pulisci">🗑 Pulisci</button>
      </div>
      <label>Aggiungi a mano (o rapido da chi ha tirato in chat)</label>
      <div class="adm-row">
        <select id="adm-nomesele" class="grow"><option value="">— dal nome in chat —</option></select>
        <input id="adm-nome" placeholder="Nome" style="width:110px">
        <input id="adm-val" type="number" placeholder="Tiro" min="0" max="30" style="width:64px">
        <button class="adm-btn" id="adm-add">+</button>
      </div>
    </div>

    <div class="adm-tabpage" id="pg-enc">
      <div class="adm-hint">Budget con tabelle DMG 5e: XP(livello) × PG × difficoltà</div>
      <div class="adm-row">
        <div class="grow"><label>PG</label><input id="enc-pc" type="number" value="4" min="1" max="8"></div>
        <div class="grow"><label>Livello</label><input id="enc-lv" type="number" value="5" min="1" max="20"></div>
        <div class="grow"><label>Difficoltà</label>
          <select id="enc-diff">
            <option value="facile">Facile</option>
            <option value="medio" selected>Medio</option>
            <option value="difficile">Difficile</option>
            <option value="mortale">Mortale</option>
          </select>
        </div>
      </div>
      <div id="enc-bud" class="adm-hint"></div>
      <div class="adm-row">
        <button class="adm-btn gold" id="enc-gen">⚔️ Genera Incontro</button>
        <button class="adm-btn" id="enc-copy" style="display:none">📋 Copia</button>
      </div>
      <div id="enc-res"></div>
      <hr style="border:none;border-top:1px solid #30303e;margin:12px 0">
      <b style="font-family:Georgia,serif;color:#d4af37">Livelli PG (sincronizzazione)</b>
      <div class="adm-row">
        <input id="pg-nome" placeholder="Nome PG" class="grow">
        <input id="pg-liv" type="number" placeholder="Liv." min="1" max="30" style="width:64px">
        <button class="adm-btn" id="pg-salva">Salva</button>
      </div>
      <div id="pg-lista" class="adm-hint"></div>
      <div class="adm-row">
        <button class="adm-btn" id="pg-media">Liv. medio → Scontri</button>
        <button class="adm-btn gold" id="pg-chat">📣 Promemoria in chat</button>
      </div>
    </div>

    <div class="adm-tabpage" id="pg-npc">
      <label>Ambientazione della campagna</label>
      <textarea id="np-amb" placeholder="Es. Città portuale corrotta, toni dark fantasy, scarsa magia…"></textarea>
      <div class="adm-row">
        <label style="margin:0;display:flex;align-items:center;gap:5px"><input type="checkbox" id="np-llm" style="width:auto"> Usa LLM (se configurato)</label>
        <button class="adm-btn gold" id="np-gen">✨ Genera PNG</button>
      </div>
      <div id="np-res"></div>
    </div>

    <div class="adm-tabpage" id="pg-loot">
      <label>Fascia CR dell'incontro superato</label>
      <select id="lt-cr">
        <option value="0-4">CR 0 – 4</option>
        <option value="5-10">CR 5 – 10</option>
        <option value="11-16">CR 11 – 16</option>
        <option value="17+">CR 17+</option>
      </select>
      <div class="adm-row">
        <button class="adm-btn gold" id="lt-gen">🎲 Genera Bottino</button>
        <button class="adm-btn" id="lt-copy" style="display:none">📋 Copia</button>
      </div>
      <div id="lt-res"></div>
    </div>

    <div class="adm-tabpage" id="pg-ev">
      <label>Bioma attuale</label>
      <select id="ev-biome"></select>
      <div class="adm-row">
        <label style="margin:0;display:flex;align-items:center;gap:5px"><input type="checkbox" id="ev-llm" style="width:auto"> Usa LLM (se configurato)</label>
        <button class="adm-btn gold" id="ev-gen">🎲 Imprevisto</button>
      </div>
      <div id="ev-res"></div>
    </div>

    <div class="adm-tabpage" id="pg-set">
      <b style="font-family:Georgia,serif;color:#d4af37">🔑 LLM (facoltativo)</b>
      <label>Provider</label>
      <select id="st-prov">
        <option value="nessuno">Nessuno (procedurale)</option>
        <option value="openrouter">OpenRouter</option>
        <option value="groq">Groq</option>
        <option value="huggingface">Hugging Face</option>
      </select>
      <label>Modello (l'elenco dei modelli gratis si carica da solo)</label>
      <div class="adm-row">
        <select id="st-modsel" class="grow"></select>
        <button class="adm-btn" id="st-modrl" title="Ricarca l'elenco">🔄</button>
      </div>
      <label>Modello personalizzato (opzionale, ha la precedenza)</label>
      <input id="st-mod" placeholder="">
      <label>Chiave API</label>
      <input id="st-key" type="password" placeholder="Incolla la chiave…">
      <div class="adm-row">
        <button class="adm-btn gold" id="st-salva">💾 Salva</button>
        <button class="adm-btn" id="st-test">📡 Testa</button>
        <button class="adm-btn danger" id="st-canc">🗑</button>
      </div>
      <div id="st-stat" class="adm-hint"></div>
      <p class="adm-hint" style="border:1px dashed rgba(84,194,136,.35);border-radius:7px;padding:6px 8px">🔒 La chiave è salvata nel localStorage del browser per roll20.net (se non disponibile, nella memoria Tampermonkey). Altri script attivi sulla stessa pagina potrebbero leggerla: usa una chiave dedicata con limiti di spesa. Viene inviata al provider scelto solo quando testi la connessione o generi con LLM.</p>
      <p class="adm-hint">Fonte mostri: <span id="st-fonte">—</span> · SRD 5.1 (OGL 1.0a)</p>
      <div class="adm-row"><button class="adm-btn" id="st-ricarica">🔄 Ricarica dati mostri</button></div>
      <div class="adm-row"><button class="adm-btn danger" id="st-reset">⚠️ Azzera dati salvati della campagna</button></div>
    </div>

    <div class="adm-toast" id="adm-toast"></div>
  </div>`;
document.body.appendChild(P);

const $ = id => P.querySelector("#"+id);
let toastT = null;
function toast(msg){
  const t = $("adm-toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(()=>t.classList.remove("show"), 2600);
}
// Blocca i doppi click: mostra il caricamento e ripristina il pulsante
// anche quando l'API non risponde o l'azione fallisce.
function conLoadingUS(id, azione, label){
  const b = $(id);
  if (b.disabled) return;
  const precedente = b.innerHTML;
  b.disabled = true;
  b.innerHTML = '<span class="adm-spin"></span> ' + esc(label || "In corso…");
  return Promise.resolve().then(azione)
    .catch(e=>{ console.error("Assistente DM:", e); toast("Errore inatteso: riprova"); })
    .finally(()=>{ b.innerHTML = precedente; b.disabled = false; });
}
// Salva l'ambientazione subito, senza attendere un timer che potrebbe
// non scattare se chiudi o aggiorni la pagina immediatamente.
$("np-amb").value = leggiDato("adm_ambientazione", "");
$("np-amb").addEventListener("input", ()=>salvaDato("adm_ambientazione", $("np-amb").value));

/* --- minimizza / chiudi / trascina --- */
$("adm-min").addEventListener("click", ()=>{
  P.classList.toggle("adm-collapsed");
  $("adm-min").textContent = P.classList.contains("adm-collapsed") ? "⚔️" : "—";
});
$("adm-close").addEventListener("click", ()=>P.remove());
try{
  GM_registerMenuCommand("Apri Assistente DM", ()=>{
    if (document.getElementById("adm-panel")) P.classList.remove("adm-collapsed");
    else location.reload(); // se chiuso, ricaricare la pagina
  });
}catch(e){}
(function drag(){
  let sx=0, sy=0, ox=0, oy=0, drag=false;
  const h = $("adm-drag");
  h.addEventListener("mousedown", e=>{
    if (e.target.tagName === "BUTTON") return;
    drag = true; sx = e.clientX; sy = e.clientY;
    const r = P.getBoundingClientRect(); ox = r.left; oy = r.top;
    e.preventDefault();
  });
  document.addEventListener("mousemove", e=>{
    if (!drag) return;
    P.style.left = clamp(ox + e.clientX - sx, 0, window.innerWidth-60) + "px";
    P.style.top = clamp(oy + e.clientY - sy, 0, window.innerHeight-40) + "px";
    P.style.right = "auto";
  });
  document.addEventListener("mouseup", ()=>drag=false);
})();

/* --- tab --- */
P.querySelectorAll("#adm-tabs button").forEach(b=>{
  b.addEventListener("click", ()=>{
    P.querySelectorAll("#adm-tabs button").forEach(x=>x.classList.toggle("adm-on", x===b));
    P.querySelectorAll(".adm-tabpage").forEach(pg=>pg.classList.toggle("on", pg.id === "pg-"+b.dataset.t));
  });
});

/* ============================================================
   INIZIATIVA — stato + rendering + watcher della chat
   ============================================================ */
let init = { lista:[], indice:-1, round:0 };
function salvaInit(){ salvaDato("adm_iniziativa", JSON.stringify(init)); }
try{
  const salv = leggiDato("adm_iniziativa","");
  if (salv){ const j = JSON.parse(salv); if (j && Array.isArray(j.lista)) init = {
    lista:j.lista.filter(x=>x && typeof x.nome==="string" && Number.isFinite(+x.init))
      .map(x=>({nome:x.nome,init:+x.init})),
    indice:Number.isInteger(j.indice)&&j.indice>=0&&j.indice<j.lista.length?j.indice:-1,
    round:Number.isInteger(j.round)&&j.round>=0?j.round:0
  }; }
}catch(e){}

function aggiungiCombattente(nome, val, daChat){
  nome = String(nome||"").trim();
  if (!nome || val == null || val === "" || !Number.isFinite(+val)) return false;
  val = +val;
  val = clamp(val, 0, 30);
  const es = init.lista.find(x=>x.nome.toLowerCase() === nome.toLowerCase());
  if (es) es.init = val; else init.lista.push({nome, init:val});
  init.indice = -1;
  renderInit();
  if (daChat){
    P.classList.remove("adm-pulse"); void P.offsetWidth; P.classList.add("adm-pulse");
    toast("🎲 Iniziativa: " + nome + " = " + val);
  }
  return true;
}
function renderInit(){
  init.lista.sort((a,b)=>b.init - a.init);
  const ol = $("adm-initlist");
  if (!init.lista.length){
    ol.innerHTML = '<div class="adm-hint">Nessun combattente. I tiri di iniziativa dalla chat appaiono qui.</div>';
    $("adm-banner").style.display = "none";
    salvaInit(); return;
  }
  ol.innerHTML = init.lista.map((c,i)=>{
    const cur = i === init.indice;
    const done = init.indice >= 0 && i > init.indice;
    return `<li class="${cur?"adm-cur":""} ${done?"adm-done":""}" data-i="${i}">
      <span class="p">${i+1}</span><span class="n">${esc(c.nome)}</span>
      <span class="v">${c.init}</span><button class="x" data-rm="${i}" title="Rimuovi">✕</button>
    </li>`;
  }).join("");
  const cur = init.lista[init.indice];
  const ban = $("adm-banner");
  if (cur){
    ban.style.display = "block";
    ban.innerHTML = "Round " + (init.round||1) + " — Turno di <b>" + esc(cur.nome) + "</b> (" + cur.init + ")";
  } else ban.style.display = "none";
  ol.querySelectorAll("li").forEach(el=>{
    el.addEventListener("click", e=>{
      if (e.target.dataset.rm != null){
        init.lista.splice(+e.target.dataset.rm, 1); init.indice = -1; renderInit(); return;
      }
      init.indice = +el.dataset.i; renderInit();
    });
  });
  salvaInit();
}
$("adm-avanza").addEventListener("click", ()=>{
  if (!init.lista.length){ toast("Aggiungi prima i combattenti"); return; }
  if (init.indice < 0){ init.indice = 0; init.round = 1; }
  else if (init.indice + 1 >= init.lista.length){ init.indice = 0; init.round++; }
  else init.indice++;
  renderInit();
});
$("adm-pulisci").addEventListener("click", ()=>{ init = {lista:[], indice:-1, round:0}; renderInit(); });
$("adm-add").addEventListener("click", ()=>{
  const nome = $("adm-nome").value || $("adm-nomesele").value;
  const val = $("adm-val").value;
  if (aggiungiCombattente(nome, val)){
    $("adm-nome").value = ""; $("adm-val").value = ""; $("adm-nomesele").value = "";
    toast("Aggiunto");
  } else toast("Inserisci nome e valore del tiro");
});
$("adm-nome").addEventListener("keydown", e=>{ if (e.key === "Enter") $("adm-add").click(); });
$("adm-val").addEventListener("keydown", e=>{ if (e.key === "Enter") $("adm-add").click(); });

/* --- WATCHER: legge i nuovi messaggi della chat di Roll20 --- */
const nomiRecenti = []; // ultimi nomi che hanno tirato un d20 in chat
function aggiornaSelectNomi(){
  const sel = $("adm-nomesele");
  const cur = sel.value;
  sel.innerHTML = '<option value="">— dal nome in chat —</option>' +
    nomiRecenti.slice(-15).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
  sel.value = cur;
}
function processaMessaggio(el){
  if (el.__admLetto) return;
  el.__admLetto = true;
  try{
    const nomeEl = el.querySelector(".chatmessage_name") || el.querySelector(".message_name");
    let nome = nomeEl ? nomeEl.textContent.trim() : "";
    const formulaEl = el.querySelector(".rollformula");
    const formula = formulaEl ? formulaEl.textContent : "";
    const testoEl = el.querySelector(".chatmessage_content") || el.querySelector(".message_content");
    const testo = testoEl ? testoEl.textContent : "";
    // totale del tiro: .rolltotal (formato attuale) oppure ultimo numero in .rollresult
    let tot = null;
    const totEl = el.querySelector(".rolltotal");
    if (totEl) tot = parseInt(totEl.textContent, 10);
    if (tot == null || isNaN(tot)){
      const resEl = el.querySelector(".rollresult");
      if (resEl){
        const nums = (resEl.textContent.match(/\d+/g) || []);
        if (nums.length) tot = parseInt(nums[nums.length-1], 10);
      }
    }
    const bundle = (nome + " " + formula + " " + testo).toLowerCase();
    const d20 = /d20/.test(formula);
    // 1) qualsiasi nome che tira un d20 viene ricordato per l'aggiunta rapida
    if (d20 && nome && !nomiRecenti.includes(nome)){
      nomiRecenti.push(nome);
      if (nomiRecenti.length > 15) nomiRecenti.shift(); // memoria limitata, anche dopo ore di chat
      aggiornaSelectNomi();
    }
    // 2) tiro di INIZIATIVA (parola "iniziativa"/"initiative" nel messaggio o nella formula)
    if (tot != null && !isNaN(tot) && /iniziativ|initiative/.test(bundle)){
      const nomeFinale = nome || "Combattente";
      aggiungiCombattente(nomeFinale, tot, true);
    }
  }catch(e){ /* non deve mai rompere la pagina Roll20 */ }
}
function avviaWatcher(){
  const oss = new MutationObserver(muts=>{
    for (const mut of muts){
      for (const node of mut.addedNodes){
        if (node.nodeType !== 1) continue;
        if (node.id === "adm-panel" || (P.contains && P.contains(node))) continue;
        let msgs = [];
        if (node.classList && node.classList.contains("chat-message")) msgs = [node];
        else if (node.querySelectorAll) msgs = Array.from(node.querySelectorAll(".chat-message"));
        msgs.forEach(processaMessaggio);
      }
    }
  });
  oss.observe(document.body, {childList:true, subtree:true});
  // messaggio di conferma
  toast("Assistente DM attivo — chat in ascolto");
}

/* ============================================================
   SCONTRI
   ============================================================ */
let ultimoEnc = null;
function paramsEnc(){
  return {
    pcs: clamp(+$("enc-pc").value || 4, 1, 8),
    liv: clamp(+$("enc-lv").value || 5, 1, 20),
    diff: $("enc-diff").value
  };
}
function aggiornaBudget(){
  const p = paramsEnc();
  $("enc-bud").innerHTML =
    "Budget: " +
    ["facile","medio","difficile","mortale"].map(d=>
      `<b style="color:${d===p.diff?"#f2dc82":"inherit"}">${NOME_DIFF[d]}</b> ${budgetXp(p.liv,p.pcs,d)}`
    ).join(" · ");
}
["enc-pc","enc-lv","enc-diff"].forEach(id=>$(id).addEventListener("input", aggiornaBudget));
$("enc-gen").addEventListener("click", ()=>{
  const p = paramsEnc();
  ultimoEnc = generaIncontro(p.liv, p.pcs, p.diff);
  const righe = ultimoEnc.list.map(g=>`${g.qta>1?g.qta+" × ":""}${g.nome} — CR ${crLabel(g.cr)}, ${g.xp} XP`).join("\n");
  const testo = `⚔️ INCONTRO — ${p.pcs} PG liv ${p.liv} (${NOME_DIFF[p.diff]})\nBudget: ${ultimoEnc.budget} XP\n${righe}\nTotale: ${ultimoEnc.totale} XP (${Math.round(ultimoEnc.quota*100)}%)`;
  $("enc-res").innerHTML = `<div class="adm-res"><div class="t">⚔️ Incontro — ${NOME_DIFF[p.diff]}</div>${esc(righe)}\nTotale: ${ultimoEnc.totale}/${ultimoEnc.budget} XP (${Math.round(ultimoEnc.quota*100)}%) — ${esc(etichettaQuota(ultimoEnc.quota))}</div>`;
  $("enc-copy").style.display = "inline-block";
  $("enc-copy").onclick = ()=>{ if (copiaTesto(testo)) toast("Incontro copiato"); else toast("Copia non riuscita"); };
  $("st-fonte").textContent = state.fonte;
});
$("enc-copy").style.display = "none";

/* --- Livelli PG: salva, media, promemoria in chat --- */
function getParty(){
  try{
    const j = JSON.parse(leggiDato("adm_party","[]"));
    return Array.isArray(j) ? j.filter(x=>x && typeof x.nome==="string" && Number.isFinite(+x.liv)) : [];
  }catch(e){ return []; }
}
function renderParty(){
  const p = getParty();
  $("pg-lista").innerHTML = p.length
    ? "PG: " + p.map(x=>`${esc(x.nome)} (liv ${x.liv})`).join(" · ")
    : "Nessun PG salvato.";
}
$("pg-salva").addEventListener("click", ()=>{
  const nome = $("pg-nome").value.trim();
  const valore = $("pg-liv").value;
  if (!nome || valore === "" || !Number.isFinite(+valore)){ toast("Inserisci nome e livello del PG"); return; }
  const liv = clamp(Math.round(+valore), 1, 30);
  let p = getParty();
  const es = p.find(x=>x.nome.toLowerCase() === nome.toLowerCase());
  if (es) es.liv = liv; else p.push({nome, liv});
  salvaDato("adm_party", JSON.stringify(p));
  $("pg-nome").value = ""; $("pg-liv").value = "";
  renderParty(); toast("PG salvato");
});
$("pg-media").addEventListener("click", ()=>{
  const p = getParty();
  if (!p.length){ toast("Salva prima qualche PG"); return; }
  const media = Math.round(p.reduce((s,x)=>s+x.liv,0)/p.length);
  $("enc-lv").value = media;
  aggiornaBudget();
  toast("Livello medio: " + media);
});
$("pg-chat").addEventListener("click", ()=>{
  const p = getParty();
  if (!p.length){ toast("Salva prima qualche PG"); return; }
  const media = Math.round(p.reduce((s,x)=>s+x.liv,0)/p.length);
  const testo = `/em ⚔️ Promemoria DM — Livello medio gruppo: ${media} (${p.map(x=>x.nome+" "+x.liv).join(" · ")})`;
  let okc = false;
  try{
    const w = (typeof unsafeWindow !== "undefined" && unsafeWindow) ? unsafeWindow : window;
    if (typeof w.SendChatMessage === "function"){ w.SendChatMessage({text:testo}); okc = true; }
  }catch(e){}
  if (okc) toast("Promemoria inviato in chat");
  else { if (copiaTesto(testo)) toast("Invio non disponibile: testo copiato, incollalo in chat"); else toast("Invio non disponibile"); }
});

/* ============================================================
   PNG / EVENTI — un unico rendering per successo e fallback
   ============================================================ */
function mostraRisultatoUS(box, titolo, testo, avviso=""){
  box.innerHTML = (avviso ? `<div class="adm-hint" style="color:#e35d5d" role="alert">⚠️ ${esc(avviso)}</div>` : "") +
    `<div class="adm-res"><div class="t">${esc(titolo)}</div>${esc(testo)}</div>`;
  const b = document.createElement("button");
  b.className = "adm-btn"; b.style.marginTop = "8px"; b.textContent = "📋 Copia";
  b.onclick = ()=>toast(copiaTesto(testo) ? "Copiato" : "Copia non riuscita");
  box.appendChild(b);
}
$("np-gen").addEventListener("click", ()=>conLoadingUS("np-gen", async ()=>{
  const amb = $("np-amb").value.trim();
  const usaLLM = $("np-llm").checked && llmConfigurato();
  const box = $("np-res");
  box.innerHTML = '<div class="adm-hint">Creazione…</div>';
  try{
    let testo;
    if (usaLLM){
      const user = `Ambientazione di campagna: "${amb || "non specificata"}"\n\nCrea un PNG secondario ma memorabile, coerente con l'ambientazione. Il segreto deve poter generare un arco narrativo; l'aggancio deve dare ai PG un motivo concreto per cercare questo PNG.`;
      testo = await chatLLM(PROMPT_SYS_NPC, user);
    } else {
      testo = generaPNGProc() + (amb ? "\n\n(Ambientazione di riferimento: " + amb + ")" : "");
    }
    mostraRisultatoUS(box, "🎭 PNG", testo,
      $("np-llm").checked && !usaLLM ? "Chiave LLM non configurata: uso i dati locali. Vai in Impostazioni." : "");
  }catch(e){
    if (usaLLM){
      const testo = generaPNGProc() + (amb ? "\n\n(Ambientazione di riferimento: " + amb + ")" : "");
      mostraRisultatoUS(box, "🎭 PNG (dati locali)", testo,
        "LLM non raggiungibile (" + e.message + "). Uso i dati locali.");
    } else box.textContent = "⚠️ Errore: " + e.message;
  }
}, "Generazione in corso…"));

/* ============================================================
   BOTTINO
   ============================================================ */
let ultimoLoot = null;
$("lt-gen").addEventListener("click", ()=>{
  const fascia = $("lt-cr").value;
  ultimoLoot = generaBottino(fascia);
  const righeMon = ultimoLoot.monete.map(m=>m.val+" "+LOOT_NOMI[m.mon]).join(" · ");
  const righeObj = ultimoLoot.oggetti.length
    ? ultimoLoot.oggetti.map(o=>"• "+o.nome+" ("+({comune:"Comune",noncomune:"Non Comune",raro:"Raro"}[o.tier])+")").join("\n")
    : "• Nessuna magia, solo monete e polvere";
  const testo = `💰 BOTTINO — CR ${fascia}\nMonete: ${righeMon}\nOggetti:\n${righeObj}\nValore stimato: ~${ultimoLoot.gp} gp`;
  $("lt-res").innerHTML = `<div class="adm-res"><div class="t">💰 Bottino — CR ${fascia}</div><b>Monete:</b> ${esc(righeMon)}\n<b>Oggetti:</b>\n${esc(righeObj)}\nValore stimato: ~${ultimoLoot.gp} gp</div>`;
  $("lt-copy").style.display = "inline-block";
  $("lt-copy").onclick = ()=>{ if (copiaTesto(testo)) toast("Bottino copiato"); else toast("Copia non riuscita"); };
});
$("lt-copy").style.display = "none";

/* ============================================================
   EVENTI
   ============================================================ */
(function(){
  const sel = $("ev-biome");
  sel.innerHTML = Object.keys(L_BIOMI).map(k=>`<option value="${k}">${L_BIOMI[k].icon} ${L_BIOMI[k].nome}</option>`).join("");
  const s = leggiDato("adm_biome","");
  if (s && L_BIOMI[s]) sel.value = s;
  sel.addEventListener("change", ()=>salvaDato("adm_biome", sel.value));
})();
$("ev-gen").addEventListener("click", ()=>conLoadingUS("ev-gen", async ()=>{
  const idB = $("ev-biome").value;
  const amb = $("np-amb").value.trim();
  const usaLLM = $("ev-llm").checked && llmConfigurato();
  const box = $("ev-res");
  box.innerHTML = '<div class="adm-hint">Generazione…</div>';
  try{
    let testo;
    if (usaLLM){
      const user = `Bioma attuale: ${L_BIOMI[idB].nome}. Ambientazione: "${amb || "non specificata"}".\n\nGenera un evento di viaggio / complicazione ambientale immediata, tono evocativo, e nei DETTAGLI inserisci una possibile conseguenza meccanica D&D (tiro salvezza o check con DC).`;
      testo = await chatLLM(PROMPT_SYS_EVENT, user);
    } else {
      const e = generaEventoProc(idB);
      testo = "METEO: " + e.meteo + "\nIMPREVVISTO: " + e.evento;
    }
    mostraRisultatoUS(box, "🌩️ " + L_BIOMI[idB].nome, testo,
      $("ev-llm").checked && !usaLLM ? "Chiave LLM non configurata: uso i dati locali. Vai in Impostazioni." : "");
  }catch(e){
    if (usaLLM){
      const p = generaEventoProc(idB);
      const testo = "METEO: " + p.meteo + "\nIMPREVVISTO: " + p.evento;
      mostraRisultatoUS(box, "🌩️ " + L_BIOMI[idB].nome + " (dati locali)", testo,
        "LLM non raggiungibile (" + e.message + "). Uso i dati locali.");
    } else box.textContent = "⚠️ Errore: " + e.message;
  }
}, "Generazione in corso…"));

/* ============================================================
   IMPOSTAZIONI LLM
   ============================================================ */
function aggiornaModelloWrap(){
  const p = $("st-prov").value;
  $("st-mod").placeholder = p === "nessuno" ? "—" : "Predefinito: " + LLM_DEFAULT_MODEL[p];
  carregaModelliUS();
}
// compila il menu a tendina con i modelli gratuiti ATTUALI
let modSeqUS = 0;
async function carregaModelliUS(){
  const seq = ++modSeqUS;
  const prov = $("st-prov").value;
  const sel = $("st-modsel");
  if (prov === "nessuno"){ sel.innerHTML = ""; return; }
  if (prov === "huggingface"){
    sel.innerHTML = '<option value="__default__">⚡ Predefinito: ' + LLM_DEFAULT_MODEL[prov] + "</option>";
    return;
  }
  sel.innerHTML = '<option value="">⏳ Caricamento…</option>';
  try{
    const lista = await listaModelliFree(prov, $("st-key").value.trim());
    if (seq !== modSeqUS || prov !== $("st-prov").value) return;
    if (!lista || !lista.length) throw new Error("vuota");
    const salvo = (getLLM().model || "").trim();
    let html = '<option value="__default__">⚡ ' + LLM_DEFAULT_MODEL[prov] + "</option>";
    for (const m of lista) html += '<option value="' + esc(m.id) + '">' + esc(m.nome) + "</option>";
    sel.innerHTML = html;
    if (salvo){ if (lista.some(m=>m.id===salvo)) sel.value = salvo; else $("st-mod").value = salvo; }
  }catch(e){
    if (seq !== modSeqUS || prov !== $("st-prov").value) return;
    sel.innerHTML = '<option value="__default__">⚠️ Elenco non caricato — predefinito (' + LLM_DEFAULT_MODEL[prov] + ")</option>";
    const salvo = (getLLM().model || "").trim();
    if (salvo) $("st-mod").value = salvo;
  }
}
// modello da usare: campo personalizzato, altrimenti selezione, altrimenti predefinito (gestito dal motore)
function modelloEffettivoUS(){
  const custom = $("st-mod").value.trim();
  const selVal = $("st-modsel").value;
  return custom || (selVal && selVal !== "__default__" ? selVal : "");
}
function carregaSettings(){
  const s = getLLM();
  $("st-prov").value = s.provider || "nessuno";
  $("st-key").value = s.key || "";
  $("st-mod").value = "";
  aggiornaModelloWrap();
  $("st-stat").textContent = s.key ? "🟢 Chiave salvata (" + s.provider + ")" : "Nessuna chiave salvata.";
}
$("st-prov").addEventListener("change", ()=>{ $("st-mod").value=""; aggiornaModelloWrap(); });
$("st-modsel").addEventListener("change", ()=>{ $("st-mod").value=""; });
$("st-modrl").addEventListener("click", ()=>conLoadingUS("st-modrl", carregaModelliUS, "Caricamento…"));
$("st-salva").addEventListener("click", ()=>{
  salvaDato("adm_llm", JSON.stringify({
    provider: $("st-prov").value, model: modelloEffettivoUS(), key: $("st-key").value.trim()
  }));
  carregaSettings(); toast("Impostazioni salvate");
});
$("st-test").addEventListener("click", ()=>conLoadingUS("st-test", async ()=>{
  const keyT = $("st-key").value.trim();
  const provT = $("st-prov").value;
  if (provT === "nessuno" || !keyT){ toast("Scegli provider e incolla la chiave"); return; }
  // Non persistere chiavi sbagliate finché l'utente non preme Salva.
  const config = {provider:provT, model:modelloEffettivoUS(), key:keyT};
  $("st-stat").textContent = "⏳ Test in corso…";
  try{
    await chatLLM("Sei un assistente di test. Rispondi solo: OK", "Di' OK.", config);
    $("st-stat").textContent = "🟢 Connesso! Premi Salva per confermare.";
    toast("Connessione riuscita");
  }catch(e){
    $("st-stat").textContent = "🔴 " + e.message;
    toast("Test fallito");
  }
}, "Test in corso…"));
$("st-canc").addEventListener("click", ()=>{
  rimuoviDato("adm_llm");
  $("st-key").value = ""; $("st-mod").value = "";
  carregaSettings(); toast("Chiave rimossa");
});
$("st-ricarica").addEventListener("click", ()=>conLoadingUS("st-ricarica", async ()=>{
  $("st-fonte").textContent = "⏳ Caricamento…";
  const okc = await caricaMostriOnline();
  $("st-fonte").textContent = okc ? state.fonte + " — " + state.mostri.length + " mostri"
    : "⚠️ Errore di connessione: uso i dati locali (" + L_MOSTRI.length + " mostri).";
  toast(okc ? "Dati online caricati" : "Errore di connessione: uso i dati locali");
}, "Caricamento…"));
$("st-reset").addEventListener("click", ()=>{
  if (!confirm("Azzero chiave, ambientazione, iniziativa, gruppo e bioma salvati per Roll20?")) return;
  ["adm_llm","adm_ambientazione","adm_iniziativa","adm_party","adm_biome"].forEach(rimuoviDato);
  init = {lista:[], indice:-1, round:0};
  $("np-amb").value = "";
  $("ev-biome").value = "foresta";
  $("st-key").value = "";
  carregaSettings(); renderInit(); renderParty();
  toast("Dati della campagna azzerati");
});

/* ============================================================
   AVVIO
   ============================================================ */
carregaSettings();
renderInit();
aggiornaBudget();
renderParty();
$("st-fonte").textContent = "Dati locali disponibili subito — collegamento API in corso…";
caricaMostriOnline().then(okc=>{
  $("st-fonte").textContent = okc ? state.fonte + " — " + state.mostri.length + " mostri"
    : "⚠️ Errore di connessione: uso i dati locali (" + L_MOSTRI.length + " mostri).";
  if (!okc) toast("Errore di connessione: uso i dati locali");
}).catch(()=>{
  $("st-fonte").textContent = "⚠️ Errore di connessione: uso i dati locali.";
});
avviaWatcher();

})();

