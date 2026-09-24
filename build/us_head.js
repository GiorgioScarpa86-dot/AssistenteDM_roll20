// ==UserScript==
// @name         Assistente DM — Pannello integrato per Roll20
// @namespace    assistente-dm.roll20
// @version      1.1.0
// @description  Assistente per Dungeon Master D&D 5e: intercetta i tiri di iniziativa dalla chat di Roll20, genera scontri bilanciati, PNG coerenti, bottino e imprevisti. Zero codice: installalo e usalo.
// @author       AssistenteDM
// @match        https://app.roll20.net/*
// @match        https://roll20.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      www.dnd5eapi.co
// @connect      openrouter.ai
// @connect      api.groq.com
// @connect      api-inference.huggingface.co
// @run-at       document-idle
// ==/UserScript==
/* ============================================================
   ASSISTENTE DM — SCRIPT TAMPERMONKEY PER ROLL20
   ------------------------------------------------------------
   Cosa fa:
   1. Aggiunge un pannello fluttuante (trascinabile) nella pagina
      di gioco di Roll20, con 6 sezioni.
   2. MONITORA LA CHAT: quando qualcuno tira un d20 con la parola
      "iniziativa"/"initiative", il combattente viene aggiunto da
      solo alla lista ordinata, e il DM avanza i turni col click.
   3. SCONTRI BILANCIATI con budget XP ufficiali (DMG 5e).
   4. PNG coerenti con l'ambientazione (procedurale o LLM).
   5. BOTTINO per fascia di CR + METEO/IMPREVVISTI per bioma.
   6. Sincronizzazione rapida dei livelli dei PG + promemoria in chat.
   7. Opzionale: chiave LLM gratuita (OpenRouter/Groq/Hugging Face)
      salvata solo nel browser.
   Dati: SRD 5.1 (licenza OGL 1.0a) + tabelle DMG 5e (metodo).
   ============================================================ */
(function(){
"use strict";

/* ---------- STILE DEL PANNELLO (iniettato nella pagina Roll20) ---------- */
const CSS = `
#adm-panel{
  position:fixed; top:70px; right:14px; width:352px; max-height:82vh; z-index:99999;
  background:#14141a; color:#eae4d8; font-family:'Inter','Segoe UI',Arial,sans-serif;
  font-size:13px; line-height:1.45; border:1px solid #30303e; border-radius:12px;
  box-shadow:0 14px 40px rgba(0,0,0,.6); display:flex; flex-direction:column; overflow:hidden;
}
#adm-panel.adm-collapsed{ max-height:none; width:auto; }
#adm-panel.adm-collapsed .adm-body, #adm-panel.adm-collapsed .adm-tabs{ display:none; }
#adm-panel.adm-pulse{ animation:admpulse 1.2s ease; }
@keyframes admpulse{ 0%,100%{box-shadow:0 14px 40px rgba(0,0,0,.6);} 40%{box-shadow:0 0 0 5px rgba(212,175,55,.55);} }
.adm-head{
  display:flex; align-items:center; gap:8px; padding:9px 12px; cursor:move;
  background:linear-gradient(180deg, rgba(139,38,53,.4), rgba(139,38,53,.15));
  border-bottom:1px solid #30303e; user-select:none;
}
.adm-head b{ font-family:Georgia,serif; color:#d4af37; font-size:14px; flex:1; letter-spacing:.5px; }
.adm-head button{
  background:#22222e; border:1px solid #30303e; color:#eae4d8; border-radius:7px;
  width:26px; height:26px; cursor:pointer; font-size:13px; padding:0;
}
.adm-head button:hover{ border-color:#d4af37; }
.adm-tabs{ display:flex; gap:3px; padding:6px 8px 0; border-bottom:1px solid #30303e; overflow-x:auto; }
.adm-tabs button{
  flex:0 0 auto; background:transparent; border:none; color:#9a93a6; font-size:11.5px; font-weight:600;
  padding:6px 9px; border-radius:7px 7px 0 0; cursor:pointer; white-space:nowrap;
}
.adm-tabs button.adm-on{ color:#f2dc82; background:#22222e; }
.adm-body{ padding:10px 12px 14px; overflow-y:auto; }
.adm-body label{ display:block; color:#9a93a6; font-size:11.5px; margin:7px 0 3px; }
.adm-body input, .adm-body select, .adm-body textarea{
  width:100%; background:#22222e; color:#eae4d8; border:1px solid #30303e;
  border-radius:7px; padding:7px 9px; font-size:12.5px; font-family:inherit; box-sizing:border-box;
}
.adm-body textarea{ min-height:56px; resize:vertical; }
.adm-row{ display:flex; gap:7px; align-items:center; flex-wrap:wrap; margin-top:8px; }
.adm-row > *{ flex:0 0 auto; }
.adm-row .grow{ flex:1 1 90px; }
.adm-btn{
  background:#22222e; color:#eae4d8; border:1px solid #30303e; border-radius:7px;
  padding:7px 11px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit;
}
.adm-btn:hover{ border-color:#d4af37; color:#f2dc82; }
.adm-btn.gold{ background:linear-gradient(180deg,#f2dc82,#d4af37 55%,#8a6d1d); color:#1c1503; border-color:#f2dc82; }
.adm-btn.gold:hover{ filter:brightness(1.08); color:#120d01; }
.adm-btn.danger{ color:#e35d5d; border-color:rgba(227,93,93,.4); }
.adm-btn:disabled{ opacity:.6; cursor:wait; pointer-events:none; }
.adm-spin{ display:inline-block; width:12px; height:12px; border:2px solid #6b6051; border-top-color:#d4af37; border-radius:50%; animation:admrot .8s linear infinite; vertical-align:-2px; }
@keyframes admrot{ to{transform:rotate(360deg)} }
.adm-hint{ color:#9a93a6; font-size:11.5px; margin:5px 0; }
#adm-panel #st-stat{ white-space:pre-wrap; overflow-wrap:anywhere; }
.adm-res{
  background:rgba(0,0,0,.3); border:1px solid #30303e; border-left:3px solid #d4af37;
  border-radius:8px; padding:10px 11px; margin-top:10px; white-space:pre-wrap; font-size:12.5px;
}
.adm-res .t{ font-family:Georgia,serif; color:#d4af37; font-size:13px; margin-bottom:6px; }
.adm-istato{ font-size:11.5px; color:#9a93a6; }
.adm-istato b{ color:#54c288; }
.adm-init{ list-style:none; margin:9px 0 0; padding:0; display:flex; flex-direction:column; gap:5px; }
.adm-init li{
  display:flex; align-items:center; gap:8px; background:#22222e; border:1px solid #30303e;
  border-radius:8px; padding:6px 9px; cursor:pointer;
}
.adm-init li:hover{ border-color:#d4af37; }
.adm-init li.adm-cur{ border-color:#d4af37; background:linear-gradient(90deg,rgba(212,175,55,.16),rgba(139,38,53,.2)); }
.adm-init li.adm-done{ opacity:.45; }
.adm-init li.adm-done span.n{ text-decoration:line-through; }
.adm-init .p{
  width:20px; height:20px; border-radius:50%; background:rgba(139,38,53,.4); border:1px solid #a93546;
  display:flex; align-items:center; justify-content:center; font-size:10.5px; font-weight:700; color:#e8aeb6; flex:0 0 auto;
}
.adm-init li.adm-cur .p{ background:#d4af37; color:#1c1503; border-color:#f2dc82; }
.adm-init .n{ flex:1; font-weight:600; }
.adm-init .v{ font-size:16px; font-weight:700; color:#f2dc82; }
.adm-init .x{ background:none; border:none; color:#9a93a6; cursor:pointer; font-size:13px; padding:0 3px; }
.adm-init .x:hover{ color:#e35d5d; }
.adm-banner{
  margin-top:9px; text-align:center; font-family:Georgia,serif; font-size:12.5px; color:#f2dc82;
  background:rgba(139,38,53,.22); border:1px solid rgba(169,53,70,.5); border-radius:8px; padding:7px;
}
.adm-tabpage{ display:none; }
.adm-tabpage.on{ display:block; }
.adm-toast{
  position:absolute; left:50%; bottom:10px; transform:translateX(-50%);
  background:#22222e; border:1px solid #d4af37; color:#eae4d8; padding:6px 12px; border-radius:8px;
  font-size:12px; white-space:nowrap; opacity:0; transition:opacity .25s; pointer-events:none; z-index:10;
}
.adm-toast.show{ opacity:1; }
`;
const stile = document.createElement("style");
stile.textContent = CSS;
document.head.appendChild(stile);

