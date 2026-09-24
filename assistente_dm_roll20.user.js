// ==UserScript==
// @name         Assistente DM — Pannello integrato per Roll20
// @namespace    assistente-dm.roll20
// @version      1.0.0
// @description  Assistente per Dungeon Master D&D 5e: intercetta i tiri di iniziativa dalla chat di Roll20, genera scontri bilanciati, PNG coerenti, bottino e imprevisti. Zero codice: installalo e usalo.
// @author       AssistenteDM
// @match        https://app.roll20.net/*
// @match        https://roll20.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
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
.adm-hint{ color:#9a93a6; font-size:11.5px; margin:5px 0; }
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

/* ============================================================
   3) DATI LOCALI — FALLBACK OFFLINE
   ------------------------------------------------------------
   Se le API pubbliche del SRD non rispondono, l'app usa questi
   dati incorporati (mostri e incantesimi del SRD 5.1, licenza
   OGL 1.0a — contenuti aperti, privi di copyright).
   I numeri dei mostri sono i valori ufficiali del SRD.
   ============================================================ */

/* --- Tabelle XP ufficiali (Guida del Dungeon Master 5e) --- */
// XP per personaggio per livello (1-20)
const XP_LIV = [100,150,200,350,500,600,800,1000,1100,1250,1500,1800,2000,2500,3300,4000,4500,5000,5500,6000];
// Moltiplicatori di difficoltà (tabella "Encounter Building", DMG 5e)
const MULT_DIFF = { facile:1.0, medio:1.5, difficile:2.0, mortale:2.5 };
const NOME_DIFF = { facile:"Facile", medio:"Medio", difficile:"Difficile", mortale:"Mortale" };
const ICONE_DIFF = { facile:"🟢", medio:"🟡", difficile:"🟠", mortale:"🔴" };
// XP assegnati a un mostro in base al suo CR (tabella DMG 5e)
const CR_XP = {0.125:25, 0.25:50, 0.5:100, 1:200, 2:450, 3:700, 4:1100, 5:1800, 6:2300, 7:2900, 8:3900, 9:5000,
  10:5900, 11:7200, 12:8400, 13:10000, 14:11500, 15:13000, 16:15000, 17:18000, 18:20000, 19:22000, 20:25000,
  21:33000, 22:41000, 23:50000, 24:62000, 25:75000};

/* --- Dizionario locale dei mostri (SRD 5.1) --- */
// Formato: n=nome, t=tipo, cr=CR, xp=XP, ca=CA, pv=PV, tiri=dadi PV, vel=velocità,
//          ab=[For,Des,Cos,Int,Sag,Car], vul/res/imm=vulnerabilità/resistenze/immunità,
//          tra=[[tratto,desc]], az=[[azione,desc]]  (descrizioni = testo ufficiale in inglese, sintetizzato)
const L_MOSTRI = [
{n:"Goblin",t:"humanoid (goblinoid), neutral evil",cr:0.25,xp:50,ca:15,pv:7,tiri:"2d6",vel:"30 ft",ab:[8,14,10,10,8,8],vul:[],res:[],imm:[],
 tra:[["Nimble Escape","Can take the Disengage or Hide action as a bonus action on each of its turns."]],
 az:[["Scimitar","Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 5 (1d6 + 2) slashing damage."],
     ["Shortbow","Ranged Weapon Attack: +4 to hit, range 80/320 ft. Hit: 5 (1d6 + 2) piercing damage."]]},
{n:"Bugbear",t:"humanoid (goblinoid), chaotic evil",cr:1,xp:200,ca:16,pv:27,tiri:"5d8+5",vel:"30 ft",ab:[15,14,13,8,11,9],vul:[],res:[],imm:[],
 tra:[["Brute","A melee weapon deals one extra die of its damage when the bugbear hits with it (included in the attack)."],
      ["Surprise Attack","If the bugbear surprises a creature and hits it with an attack during the first round of combat, the target takes an extra 7 (2d6) damage."]],
 az:[["Morningstar","Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 11 (2d8 + 2) piercing damage."],
     ["Javelin","Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 30/120 ft. Hit: 9 (2d6 + 2) or 5 (1d6 + 2) piercing damage."]]},
{n:"Hobgoblin",t:"humanoid (goblinoid), lawful evil",cr:0.5,xp:100,ca:18,pv:11,tiri:"2d8+2",vel:"30 ft",ab:[13,12,12,10,10,9],vul:[],res:[],imm:[],
 tra:[["Martial Advantage","Once per turn, the hobgoblin can deal an extra 7 (2d6) damage to a creature it hits with a weapon attack if that creature is within 5 ft. of an ally."]],
 az:[["Longsword","Melee Weapon Attack: +3 to hit, reach 5 ft. Hit: 5 (1d8 + 1) or 6 (1d10 + 1) slashing damage."],
     ["Longbow","Ranged Weapon Attack: +3 to hit, range 150/600 ft. Hit: 5 (1d8 + 1) piercing damage."]]},
{n:"Orc",t:"humanoid (orc), chaotic evil",cr:0.5,xp:100,ca:13,pv:15,tiri:"2d8+6",vel:"30 ft",ab:[16,12,16,7,11,10],vul:[],res:[],imm:[],
 tra:[["Aggressive","As a bonus action, the orc can move up to its speed toward a hostile creature that it can see."]],
 az:[["Greataxe","Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 9 (1d12 + 3) slashing damage."],
     ["Javelin","Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 30/120 ft. Hit: 6 (1d6 + 3) piercing damage."]]},
{n:"Ogre",t:"giant, chaotic evil",cr:2,xp:450,ca:11,pv:59,tiri:"7d10+21",vel:"40 ft",ab:[19,8,16,5,7,7],vul:[],res:[],imm:[],
 tra:[],
 az:[["Greatclub","Melee Weapon Attack: +6 to hit, reach 5 ft. Hit: 13 (2d8 + 4) bludgeoning damage."],
     ["Javelin","Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 30/120 ft. Hit: 11 (2d6 + 4) piercing damage."]]},
{n:"Skeleton",t:"undead, lawful evil",cr:0.25,xp:50,ca:13,pv:13,tiri:"2d8+4",vel:"30 ft",ab:[10,14,15,6,8,5],vul:["bludgeoning"],res:[],imm:["poison"],
 tra:[],
 az:[["Shortsword","Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 5 (1d6 + 2) piercing damage."],
     ["Shortbow","Ranged Weapon Attack: +4 to hit, range 80/320 ft. Hit: 5 (1d6 + 2) piercing damage."]]},
{n:"Zombie",t:"undead, neutral evil",cr:0.25,xp:50,ca:8,pv:22,tiri:"3d8+9",vel:"20 ft",ab:[13,6,16,3,6,5],vul:[],res:[],imm:["poison"],
 tra:[["Undead Fortitude","If damage reduces the zombie to 0 hit points, it must make a Constitution saving throw with a DC of 5 + the damage taken, unless the damage is radiant or from a critical hit. On a success, the zombie drops to 1 hit point instead."]],
 az:[["Slam","Melee Weapon Attack: +3 to hit, reach 5 ft. Hit: 4 (1d6 + 1) bludgeoning damage."]]},
{n:"Wolf",t:"beast, unaligned",cr:0.25,xp:50,ca:13,pv:11,tiri:"2d8+2",vel:"40 ft",ab:[12,15,12,3,12,6],vul:[],res:[],imm:[],
 tra:[["Keen Hearing and Smell","Advantage on Wisdom (Perception) checks that rely on hearing or smell."],
      ["Pack Tactics","Advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 ft. of the creature and isn't incapacitated."]],
 az:[["Bite","Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 7 (2d4 + 2) piercing damage. If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone."]]},
{n:"Dire Wolf",t:"beast, unaligned",cr:1,xp:200,ca:14,pv:37,tiri:"5d10+10",vel:"50 ft",ab:[17,15,15,3,12,7],vul:[],res:[],imm:[],
 tra:[["Keen Hearing and Smell","Advantage on Wisdom (Perception) checks that rely on hearing or smell."],
      ["Pack Tactics","Advantage on an attack roll against a creature if at least one of its allies is within 5 ft. of the creature and isn't incapacitated."]],
 az:[["Bite","Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 10 (2d6 + 3) piercing damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone."]]},
{n:"Giant Spider",t:"beast, unaligned",cr:1,xp:200,ca:14,pv:26,tiri:"4d10+4",vel:"30 ft, climb 30 ft",ab:[14,16,12,2,11,4],vul:[],res:[],imm:[],
 tra:[["Spider Climb","Can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check."],
      ["Web Sense","While in contact with a web, the spider knows the exact location of any other creature in contact with the same web."],
      ["Web Walker","Ignores movement restrictions caused by webbing."]],
 az:[["Bite","Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 7 (1d8 + 3) piercing damage, plus the target must make a DC 11 Constitution saving throw, taking 9 (2d8) poison damage on a failed save, or half as much on a success. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour and is paralyzed while poisoned in this way."],
     ["Web (Recharge 5–6)","Ranged Weapon Attack: +5 to hit, range 30/60 ft. Hit: the target is restrained by webbing. A DC 12 Strength check allows escape. The webbing has AC 10, 5 hp, is vulnerable to fire, and immune to bludgeoning, poison, and psychic damage."]]},
{n:"Giant Centipede",t:"beast, unaligned",cr:0.25,xp:50,ca:13,pv:4,tiri:"1d6+1",vel:"30 ft, climb 30 ft",ab:[5,14,12,1,7,3],vul:[],res:[],imm:[],
 tra:[],
 az:[["Bite","Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 4 (1d4 + 2) piercing damage, and the target must succeed on a DC 11 Constitution saving throw or take 10 (3d6) poison damage. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour and is paralyzed while poisoned in this way."]]},
{n:"Owlbear",t:"monstrosity, unaligned",cr:3,xp:700,ca:13,pv:59,tiri:"7d10+21",vel:"40 ft",ab:[20,12,17,3,12,7],vul:[],res:[],imm:[],
 tra:[["Keen Sight and Smell","Advantage on Wisdom (Perception) checks that rely on sight or smell."]],
 az:[["Multiattack","The owlbear makes two attacks: one with its beak and one with its claws."],
     ["Beak","Melee Weapon Attack: +7 to hit, reach 5 ft. Hit: 10 (1d10 + 5) piercing damage."],
     ["Claws","Melee Weapon Attack: +7 to hit, reach 5 ft. Hit: 14 (2d8 + 5) slashing damage."]]},
{n:"Gelatinous Cube",t:"ooze, unaligned",cr:2,xp:450,ca:6,pv:84,tiri:"8d10+40",vel:"15 ft",ab:[14,3,20,1,6,1],vul:[],res:[],imm:[],
 tra:[["Ooze Cube","The cube takes up its entire space. Creatures that enter its space are subjected to its Engulf. The cube can hold only one Large creature or up to four Medium or smaller creatures inside it at a time."],
      ["Transparent","Even when in plain sight, it takes a successful DC 15 Wisdom (Perception) check to spot a cube that has neither moved nor attacked."]],
 az:[["Pseudopod","Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 10 (3d6) acid damage."],
     ["Engulf","The cube moves up to its speed, entering Large or smaller creatures' spaces. A creature in the path must make a DC 12 Dexterity saving throw. On a failure the creature takes 10 (3d6) acid damage and is engulfed: it can't breathe, is restrained, and takes 21 (6d6) acid damage at the start of each of the cube's turns. A DC 12 Strength check as an action allows escape."]]},
{n:"Mimic",t:"monstrosity (shapechanger), neutral",cr:2,xp:450,ca:12,pv:58,tiri:"9d8+18",vel:"15 ft",ab:[17,12,15,5,13,8],vul:[],res:[],imm:["acid"],
 tra:[["Shapechanger","Can polymorph into an object or back into its true, amorphous form. Reverts if it dies."],
      ["Adhesive (Object Form Only)","The mimic adheres to anything that touches it. A Huge or smaller creature adhered to it is also grappled (escape DC 13), with disadvantage on checks to escape."],
      ["False Appearance (Object Form Only)","While motionless, it is indistinguishable from an ordinary object."],
      ["Grappler","Has advantage on attack rolls against any creature grappled by it."]],
 az:[["Pseudopod","Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 7 (1d8 + 3) bludgeoning damage. If the mimic is in object form, the target is subjected to its Adhesive trait."],
     ["Bite","Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 7 (1d8 + 3) piercing damage plus 4 (1d8) acid damage."]]},
{n:"Wraith",t:"undead, neutral evil",cr:5,xp:1800,ca:13,pv:67,tiri:"9d8+27",vel:"fly 60 ft (hover)",ab:[6,16,16,12,14,15],vul:[],res:["acid, cold, fire, lightning, thunder","bludgeoning, piercing, and slashing from nonmagical weapons that aren't silvered"],imm:["necrotic","poison"],
 tra:[["Incorporeal Movement","Can move through other creatures and objects as if they were difficult terrain. Takes 5 (1d10) force damage if it ends its turn inside an object."],
      ["Sunlight Sensitivity","In sunlight, has disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight."]],
 az:[["Life Drain","Melee Weapon Attack: +6 to hit, reach 5 ft. Hit: 21 (4d8 + 3) necrotic damage. The target must succeed on a DC 14 Constitution saving throw or its hit point maximum is reduced by the damage taken until a long rest. The target dies if its maximum is reduced to 0."]]},
{n:"Wight",t:"undead, neutral evil",cr:3,xp:700,ca:14,pv:45,tiri:"6d8+18",vel:"30 ft",ab:[15,14,16,10,13,15],vul:[],res:["necrotic","bludgeoning, piercing, and slashing from nonmagical weapons that aren't silvered"],imm:["poison"],
 tra:[["Sunlight Sensitivity","In sunlight, has disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight."]],
 az:[["Multiattack","Makes two longsword attacks or two longbow attacks. It can use its Life Drain in place of one longsword attack."],
     ["Life Drain","Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 5 (1d6 + 2) necrotic damage. The target must succeed on a DC 13 Constitution saving throw or its hit point maximum is reduced by the damage taken until a long rest. A humanoid slain by this attack rises 24 hours later as a zombie under the wight's control (max 12)."],
     ["Longsword","Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 6 (1d8 + 2) or 7 (1d10 + 2) slashing damage."],
     ["Longbow","Ranged Weapon Attack: +4 to hit, range 150/600 ft. Hit: 6 (1d8 + 2) piercing damage."]]},
{n:"Hill Giant",t:"giant, chaotic evil",cr:5,xp:1800,ca:13,pv:105,tiri:"10d12+40",vel:"40 ft",ab:[21,8,19,5,9,6],vul:[],res:[],imm:[],
 tra:[],
 az:[["Multiattack","The giant makes two greatclub attacks."],
     ["Greatclub","Melee Weapon Attack: +8 to hit, reach 10 ft. Hit: 18 (3d8 + 5) bludgeoning damage."],
     ["Rock","Ranged Weapon Attack: +8 to hit, range 60/240 ft. Hit: 21 (3d10 + 5) bludgeoning damage."]]},
{n:"Troll",t:"giant, chaotic evil",cr:5,xp:1800,ca:15,pv:84,tiri:"8d10+40",vel:"30 ft",ab:[18,13,20,7,9,7],vul:[],res:[],imm:[],
 tra:[["Keen Smell","Advantage on Wisdom (Perception) checks that rely on smell."],
      ["Regeneration","Regains 10 hit points at the start of its turn. If the troll takes acid or fire damage, this trait doesn't function at the start of its next turn. The troll dies only if it starts its turn with 0 hit points and doesn't regenerate."]],
 az:[["Multiattack","Makes three attacks: one with its bite and two with its claws."],
     ["Bite","Melee Weapon Attack: +7 to hit, reach 5 ft. Hit: 7 (1d6 + 4) piercing damage."],
     ["Claw","Melee Weapon Attack: +7 to hit, reach 5 ft. Hit: 11 (2d6 + 4) slashing damage."]]},
{n:"Mummy",t:"undead, lawful evil",cr:3,xp:700,ca:11,pv:58,tiri:"9d8+18",vel:"20 ft",ab:[16,8,15,6,10,12],vul:["fire"],res:["bludgeoning, piercing, and slashing from nonmagical weapons"],imm:["necrotic","poison"],
 tra:[],
 az:[["Multiattack","Uses its Dreadful Glare and makes one attack with its rotting fist."],
     ["Rotting Fist","Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 10 (2d6 + 3) bludgeoning damage plus 10 (3d6) necrotic damage. If the target is a creature, it must succeed on a DC 12 Constitution saving throw or be cursed with mummy rot: it can't regain hit points and its hit point maximum decreases by 10 (3d6) for every 24 hours. The curse lasts until removed by remove curse or similar magic."],
     ["Dreadful Glare","One creature within 60 ft. must succeed on a DC 11 Wisdom saving throw or become frightened until the end of the mummy's next turn. If it fails by 5 or more, it is also paralyzed for the same duration."]]},
{n:"Drider",t:"monstrosity, chaotic evil",cr:6,xp:2300,ca:19,pv:123,tiri:"13d10+52",vel:"30 ft, climb 30 ft",ab:[16,16,18,13,14,12],vul:[],res:[],imm:[],
 tra:[["Fey Ancestry","Advantage on saving throws against being charmed; magic can't put the drider to sleep."],
      ["Innate Spellcasting","Spellcasting ability is Wisdom (spell save DC 13). At will: dancing lights. 1/day each: darkness, faerie fire."],
      ["Spider Climb","Can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check."],
      ["Sunlight Sensitivity","In sunlight, has disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight."],
      ["Web Walker","Ignores movement restrictions caused by webbing."]],
 az:[["Multiattack","Makes three attacks, either with its longsword or its longbow. It can replace one of those attacks with a bite attack."],
     ["Bite","Melee Weapon Attack: +6 to hit, reach 5 ft. Hit: 2 (1d4) piercing damage plus 9 (2d8) poison damage."],
     ["Longsword","Melee Weapon Attack: +6 to hit, reach 5 ft. Hit: 7 (1d8 + 3) or 8 (1d10 + 3) slashing damage."],
     ["Longbow","Ranged Weapon Attack: +6 to hit, range 150/600 ft. Hit: 7 (1d8 + 3) piercing damage plus 4 (1d8) poison damage."]]},
{n:"Rust Monster",t:"monstrosity, unaligned",cr:0.5,xp:100,ca:14,pv:27,tiri:"5d8+5",vel:"40 ft",ab:[13,12,13,2,13,6],vul:[],res:[],imm:[],
 tra:[["Iron Scent","Can pinpoint, by scent, the location of ferrous metal within 30 feet of it."],
      ["Rust Metal","Any nonmagical metal weapon that hits the rust monster corrodes, taking a permanent and cumulative -1 penalty to damage rolls (destroyed at -5). Nonmagical metal ammunition that hits it is destroyed."]],
 az:[["Bite","Melee Weapon Attack: +3 to hit, reach 5 ft. Hit: 5 (1d8 + 1) piercing damage."],
     ["Antennae","Corrodes a nonmagical ferrous metal object within 5 feet. An object being worn or carried can be protected by a DC 11 Dexterity saving throw. Metal armor/shield touched takes a permanent -1 penalty to the AC it offers (destroyed at AC 10 / +0 shield). Held metal weapons rust as in Rust Metal."]]},
{n:"Swarm of Insects",t:"swarm of Tiny beasts, unaligned",cr:0.5,xp:100,ca:12,pv:22,tiri:"5d8",vel:"20 ft, climb 20 ft",ab:[3,13,10,1,7,1],vul:[],res:["bludgeoning","piercing","slashing"],imm:[],
 tra:[["Swarm","Can occupy another creature's space and vice versa, and move through any opening large enough for a Tiny insect. Can't regain hit points or gain temporary hit points."]],
 az:[["Bites","Melee Weapon Attack: +3 to hit, reach 0 ft. Hit: 10 (4d4) piercing damage, or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer."]]},
{n:"Harpy",t:"monstrosity, chaotic evil",cr:1,xp:200,ca:11,pv:38,tiri:"7d8+7",vel:"20 ft, fly 40 ft",ab:[12,13,12,7,10,13],vul:[],res:[],imm:[],
 tra:[],
 az:[["Multiattack","Makes two attacks: one with its claws and one with its club."],
     ["Claws","Melee Weapon Attack: +3 to hit, reach 5 ft. Hit: 6 (2d4 + 1) slashing damage."],
     ["Club","Melee Weapon Attack: +3 to hit, reach 5 ft. Hit: 3 (1d4 + 1) bludgeoning damage."],
     ["Luring Song","Every humanoid and giant within 300 ft. that can hear the song must succeed on a DC 11 Wisdom saving throw or be charmed until the song ends. While charmed, a target is incapacitated and moves toward the harpy on its turn (it can repeat the save at the end of each of its turns). The harpy must use a bonus action to keep singing."]]},
{n:"Quasit",t:"fiend (demon), chaotic evil",cr:1,xp:200,ca:13,pv:7,tiri:"3d4",vel:"40 ft",ab:[5,17,10,7,10,10],vul:[],res:["cold, fire, lightning","bludgeoning, piercing, and slashing from nonmagical weapons"],imm:["poison"],
 tra:[["Shapechanger","Can polymorph into a bat, a centipede, or a toad, or back into its true form. Same statistics, different speeds."],
      ["Magic Resistance","Advantage on saving throws against spells and other magical effects."]],
 az:[["Claw (Bite in Beast Form)","Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 5 (1d4 + 3) piercing damage, and the target must succeed on a DC 10 Constitution saving throw or take 5 (2d4) poison damage and become poisoned for 1 minute (can repeat the save at the end of each of its turns)."],
     ["Scare (1/Day)","One creature within 20 ft. must succeed on a DC 10 Wisdom saving throw or be frightened for 1 minute (can repeat the save at the end of each of its turns, with disadvantage while in line of sight)."],
     ["Invisibility","Magically turns invisible until it attacks or uses Scare, or until its concentration ends. Equipment is invisible with it."]]},
{n:"Adult Black Dragon",t:"dragon, chaotic evil",cr:14,xp:11500,ca:19,pv:195,tiri:"17d12+85",vel:"40 ft, fly 80 ft, swim 40 ft",ab:[23,14,21,14,13,17],vul:[],res:[],imm:["acid"],
 tra:[["Amphibious","Can breathe air and water."],
      ["Legendary Resistance (3/Day)","If the dragon fails a saving throw, it can choose to succeed instead."]],
 az:[["Multiattack","Can use its Frightful Presence, then makes three attacks: one with its bite and two with its claws."],
     ["Bite","Melee Weapon Attack: +11 to hit, reach 10 ft. Hit: 17 (2d10 + 6) piercing damage plus 4 (1d8) acid damage."],
     ["Claw","Melee Weapon Attack: +11 to hit, reach 5 ft. Hit: 13 (2d6 + 6) slashing damage."],
     ["Tail","Melee Weapon Attack: +11 to hit, reach 15 ft. Hit: 15 (2d8 + 6) bludgeoning damage."],
     ["Frightful Presence","Each creature of the dragon's choice within 120 ft. must succeed on a DC 16 Wisdom saving throw or become frightened for 1 minute (can repeat the save at the end of each of its turns)."],
     ["Acid Breath (Recharge 5–6)","Exhales acid in a 60-ft line 5 ft wide. Each creature in the line must make a DC 18 Dexterity saving throw, taking 54 (12d8) acid damage on a failure, or half as much on a success."]],
 leg:[["Detect","The dragon makes a Wisdom (Perception) check."],
      ["Tail Attack","The dragon makes a tail attack."],
      ["Wing Attack (2 Actions)","Each creature within 10 ft. must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed."]]},
{n:"Tarrasque",t:"monstrosity (titan), unaligned",cr:30,xp:155000,ca:25,pv:676,tiri:"33d20+330",vel:"40 ft",ab:[30,11,30,3,11,11],vul:[],res:[],imm:["fire","poison","bludgeoning, piercing, and slashing from nonmagical weapons"],
 tra:[["Legendary Resistance (3/Day)","If the tarrasque fails a saving throw, it can choose to succeed instead."],
      ["Magic Resistance","Advantage on saving throws against spells and other magical effects."],
      ["Reflective Carapace","When targeted by magic missile, a line spell, or a spell requiring a ranged attack roll, roll a d6: on a 1–5 the tarrasque is unaffected; on a 6 the effect is reflected back at the caster."],
      ["Siege Monster","Deals double damage to objects and structures."]],
 az:[["Multiattack","Can use its Frightful Presence, then makes five attacks: bite, two claws, horns, tail. Can use Swallow instead of its bite."],
     ["Bite","Melee Weapon Attack: +19 to hit, reach 10 ft. Hit: 36 (4d12 + 10) piercing damage. If the target is a creature, it is grappled (escape DC 20) and restrained."],
     ["Claw","Melee Weapon Attack: +19 to hit, reach 15 ft. Hit: 28 (4d8 + 10) slashing damage."],
     ["Horns","Melee Weapon Attack: +19 to hit, reach 10 ft. Hit: 32 (4d10 + 10) piercing damage."],
     ["Tail","Melee Weapon Attack: +19 to hit, reach 20 ft. Hit: 24 (4d6 + 10) bludgeoning damage. If the target is a creature, it must succeed on a DC 20 Strength saving throw or be knocked prone."],
     ["Frightful Presence","Each creature of the tarrasque's choice within 120 ft. must succeed on a DC 17 Wisdom saving throw or become frightened for 1 minute."],
     ["Swallow","Makes a bite attack against a Large or smaller creature it is grappling. If it hits, the target is swallowed: blinded, restrained, with total cover, and it takes 56 (16d6) acid damage at the start of each of the tarrasque's turns."]],
 leg:[["Attack","The tarrasque makes one claw or tail attack."],
      ["Move","The tarrasque moves up to half its speed."],
      ["Chomp (2 Actions)","The tarrasque makes one bite attack or uses its Swallow."]]}
];

/* --- Dizionario locale degli incantesimi (SRD 5.1, desc in italiano) --- */
// Formato: n=nome, liv=livello (0=incantesimo minore), sc=scuola, ct=tempo di lancio,
//          rg=portata, comp=componenti, dur=durata, con=concentrazione, desc=descrizione, hl=livelli superiori
const L_SPELLS = [
{n:"Dardi Arcani",nE:"Magic Missile",liv:0,sc:"Evocazione",ct:"1 azione",rg:"120 piedi",comp:"V",dur:"Istantanea",con:false,
 desc:"Tre dardi di forza arcanica volano verso bersagli alla tua portata. Per ogni dado, scegli un bersaglio nell'area o un nuovo bersaglio nella portata. Un dado di 1d4+1 danni di forza per dardo. Ogni dardo infligge i suoi danni contro un bersaglio, poi i dardi rimanenti contro un secondo bersaglio."},
{n:"Fulmine di Fuoco",nE:"Fire Bolt",liv:0,sc:"Evocazione",ct:"1 azione",rg:"120 piedi",comp:"V, S",dur:"Istantanea",con:false,
 desc:"Spari un lampo di fuoco verso una creatura entro la portata. Tiro di attacco da incantesimo a distanza: su un successo infliggi 1d10 danni da fuoco. Il danno aumenta di 1d10 quando raggiungi il 5°, il 11° e il 17° livello."},
{n:"Scudo",nE:"Shield",liv:1,sc:"Abiurazione",ct:"Reazione (quando vieni colpito o siete bersaglio di Palla di Fuoco)",rg:"Te stesso",comp:"S",dur:"1 round",con:false,
 desc:"Una barriera di energia arcana compare e ti protegge. Fino all'inizio del tuo prossimo turno la tua CA aumenta di 5 e hai vantaggio sui tiri salvezza sulla Destrezza. Se non hai le mani libere per i componenti, non puoi lanciare questo incantesimo."},
{n:"Curare Ferite",nE:"Cure Wounds",liv:1,sc:"Evocazione",ct:"1 azione",rg:"Tatto",comp:"V, S",dur:"Istantanea",con:false,
 desc:"Una creatura che tocchi recupera 1d8 punti ferita, aumentati del tuo modificatore di lancio. Puoi lanciare questo incantesimo usando un livello superiore: il danno aumenta di 1d8 per ogni livello oltre il primo."},
{n:"Armaglia Magica",nE:"Mage Armor",liv:1,sc:"Abiurazione",ct:"1 azione",rg:"Tatto",comp:"V, S, M",dur:"8 ore",con:false,
 desc:"Tocchi una creatura non indossante armatura. Fino alla durata, la sua CA diventa 13 + modificatore di Destrezza. L'incantesimo termina se la creatura indossa armatura o se lanci l'incantesimo di nuovo su di lei."},
{n:"Rilevamento Magia",nE:"Detect Magic",liv:1,sc:"Divinazione",ct:"1 azione",rg:"Te stesso",comp:"V, S",dur:"10 minuti (concentrazione)",con:true,
 desc:"Se c'è magia entro 30 piedi, la senti: sai la sua presenza e, quando non la vedi, la direzione. Concentrandoti su una creatura o un oggetto nell'area, ne scopri la scuola di magia. Inoltre rivela la posizione di piani astrali, eterei e magici entro 30 piedi."},
{n:"Benedizione",nE:"Bless",liv:1,sc:"Incantesimo",ct:"1 azione",rg:"30 piedi",comp:"V, S, M",dur:"1 minuto (concentrazione)",con:true,
 desc:"Fino a 3 creature alla portata scelgono di essere benedette. Ogni volta che una creatura che può vederti tira per un attacco o un tiro salvezza, può tirare un d4 e aggiungere il risultato al tiro."},
{n:"Fermare Persona",nE:"Hold Person",liv:1,sc:"Incantesimo",ct:"1 azione",rg:"60 piedi",comp:"V, S, M",dur:"1 ora (concentrazione)",con:true,
 desc:"Una creatura umanoide che puoi vedere deve superare un tiro salvezza sulla Saggezza, altrimenti resta paralizzato. Alla fine di ogni suo turno può ritentare: su successo l'effetto termina. Se riesce al tiro con margine di 5 o più, l'effetto termina e lei è immune a questo incantesimo per 24 ore."},
{n:"Sonno",nE:"Sleep",liv:1,sc:"Incantesimo",ct:"1 azione",rg:"30 piedi",comp:"V, S, M",dur:"1 minuto",con:false,
 desc:"Un'onda di energia sonnolenta circola nell'area. A partire dalla creatura più vicina, ogni creatura non immune deve tirare salvezza: chi fallisce cade in trance magica. Se l'energia non è esaurita, passa alla creatura successiva. Una creatura addormentata si risveglia se subisce danni o se qualcuno la usa per aiutarla o salvarla."},
{n:"Ondata di Tuono",nE:"Thunderwave",liv:1,sc:"Evocazione",ct:"1 azione",rg:"Tu stesso (cubo di 15 piedi)",comp:"V, S",dur:"Istantanea",con:false,
 desc:"Un'onda di energia sonica si propaga in un cubo di 15 piedi. Ogni creatura nel cubo subisce 2d6 danni da tuono e deve superare un tiro salvezza sulla Destrezza, altrimenti viene spinta di 10 piedi. Oggetti non ancorati vengono spostati, e i muri sottili vengono infranti dal suono."},
{n:"Caduta Piumata",nE:"Feather Fall",liv:1,sc:"Evocazione",ct:"1 azione",rg:"60 piedi",comp:"V, S, M",dur:"1 minuto",con:false,
 desc:"La velocità di discesa di fino a 5 creature alla portata si riduce a 60 piedi al round. Se, all'inizio del tuo turno, una creatura sta ancora cadendo, la sua velocità di discesa diventa 0."},
{n:"Fulmine Guida",nE:"Guiding Bolt",liv:1,sc:"Evocazione",ct:"1 azione",rg:"120 piedi",comp:"V",dur:"4 round",con:false,
 desc:"Un lampo di luce arcanica si abbatte su una creatura entro la portata. Tiro di attacco da incantesimo a distanza con vantaggio: su un successo infliggi 4d6 danni da fulmine e il prossimo tiro di attacco contro di lei entro 1 round ha vantaggio. L'incantesimo termina se non la colpisci o se la concentrazione termina."},
{n:"Santuario",nE:"Sanctuary",liv:1,sc:"Abiurazione",ct:"1 azione",rg:"20 piedi",comp:"V, S, M",dur:"1 minuto",con:false,
 desc:"Un bagliore argentato circonda una creatura alla portata. Fino alla fine, chiunque che compia un attacco o lanci un incantesimo che la miri deve superare un tiro salvezza sulla Saggezza, altrimenti l'azione fallisce. Se la creatura compie un attacco o infligge danni, l'incantesimo termina."},
{n:"Protezione dal Bene e dal Male",nE:"Protection from Evil and Good",liv:1,sc:"Abiurazione",ct:"1 azione",rg:"Tatto",comp:"V, S, M",dur:"10 minuti (concentrazione)",con:true,
 desc:"Finché dura, una creatura alla portata non può essere danneggiata, mirata, rilevata o trattenuta da creature abissali, celesti, elementali, infernali o non vive. Ha vantaggio su tiri salvezza contro di esse, e i demoni, celesti, elementali, infernali e non morti non possono contattarla o mirarla con incantesimi."},
{n:"Intrappolamento",nE:"Entangle",liv:1,sc:"Coniurazione",ct:"1 azione",rg:"90 piedi",comp:"V, S",dur:"1 minuto (concentrazione)",con:true,
 desc:"Vite di vegetazione spuntano dal terreno in un quadrato di 90 piedi. Ogni creatura nell'area deve superare un tiro salvezza sulla Forza, altrimenti è trattenuta dalla vegetazione fino alla fine dell'incantesimo. Le creature che non possono muoversi sono bloccate. Un oggetto o una creatura trattenuta può usare un'azione con una prova di Forza (CA) per liberarsi."},
{n:"Lungo Passo",nE:"Longstrider",liv:2,sc:"Mutazione",ct:"1 azione",rg:"Tatto",comp:"S",dur:"1 ora",con:false,
 desc:"Tocchi una creatura: la sua velocità aumenta di 10 piedi e i suoi tiri per abilità di Destrezza non subiscono svantaggio. L'incantesimo termina se lo lanci di nuovo sulla stessa creatura."},
{n:"Passo Nebbioso",nE:"Misty Step",liv:2,sc:"Evocazione",ct:"Azione bonus",rg:"Te stesso",comp:"S",dur:"Istantanea",con:false,
 desc:"Sparisci brevemente dal piano astrale e ricompari entro 30 piedi. Puoi farlo solo in uno spazio che puoi vedere, e se vieni spostato contro la tua volontà, l'incantesimo termina senza effetto. Ogni materiale che porti o trasporti si teleporta con te."},
{n:"Invisibilità",nE:"Invisibility",liv:2,sc:"Illusione",ct:"1 azione",rg:"Tatto",comp:"V, S",dur:"1 ora (concentrazione)",con:true,
 desc:"Una creatura che tocchi diventa invisibile fino alla fine: l'unico cosa visibile è ciò che indossa o porta (se lo porti, diventa invisibile anche tu). L'incantesimo termina per la creatura se essa attacca o infligge danni."},
{n:"Ragnatela",nE:"Web",liv:2,sc:"Coniurazione",ct:"1 azione",rg:"60 piedi",comp:"V, S, M",dur:"10 minuti (concentrazione)",con:true,
 desc:"Crea un punto di ragnatela spessa entro la portata, che riempie un cubo di 20 piedi fino alla fine. Il terreno nell'area diventa terreno difficile. Un effetto di fuoco brucia le ragnatele (CA 60, PF 5 per sezione di 10 piedi). Una creatura che inizia o termina il turno nell'area deve superare un tiro salvezza sulla Destrezza: su fallimento, è trattenuta finché non ne esce. Una creatura trattenuta può usare un'azione con una prova di Forza (CA) per uscire."},
{n:"Accelero",nE:"Haste",liv:3,sc:"Mutazione",ct:"1 azione",rg:"30 piedi",comp:"V, S",dur:"1 minuto (concentrazione)",con:true,
 desc:"Una creatura alla portata diventa magicamente aggrappata. CA +2, vantaggio sui tiri salvezza sulla Destrezza, velocità raddoppiata, e può usare un'azione extra ogni turno (solo Azione, Azione bonus, o Reazione). Al termine subisce stordimento."},
{n:"Controincantesimo",nE:"Counterspell",liv:3,sc:"Abiurazione",ct:"Reazione (quando qualcuno lancia un incantesimo entro 60 piedi)",rg:"60 piedi",comp:"S",dur:"Istantanea",con:false,
 desc:"Cerchi di annullare l'incantesimo. Se l'incantesimo è di 5° livello o inferiore, è annullato automaticamente. Se è di 6° o superiore, il tuo modificatore di lancio deve eguagliare o superare il suo: DC 13 + livello dell'incantesimo."},
{n:"Volo",nE:"Fly",liv:3,sc:"Mutazione",ct:"1 azione",rg:"Tatto",comp:"V, S",dur:"10 minuti (concentrazione)",con:true,
 desc:"La velocità di volo di una creatura che tocchi diventa 60 piedi. Se l'incantesimo termina prima della durata, la creatura cade, se è ancora in aria, a meno che non possa evitare la caduta. Una creatura che vola cade a fine turno se non può muoversi."},
{n:"Fulmine a Dado",nE:"Lightning Bolt",liv:3,sc:"Evocazione",ct:"1 azione",rg:"Te stesso (linea di 100 piedi, 5 piedi di larghezza)",comp:"V, S",dur:"Istantanea",con:false,
 desc:"Un fulmine azzurro scatta in una linea di 100 piedi. Ogni creatura nella linea deve superare un tiro salvezza sulla Destrezza, subendo 8d6 danni da fulmine su un fallimento, o metà su un successo. L'fulmine infiamma gli oggetti combustibili non indossati."},
{n:"Nube Nociva",nE:"Stinking Cloud",liv:3,sc:"Coniurazione",ct:"1 azione",rg:"90 piedi",comp:"V, S, M",dur:"1 minuto (concentrazione)",con:true,
 desc:"Evoca una nube di veleno che riempie un cubo di 20 piedi per la durata. La nube si sposta al tuo turno, 10 piedi alla volta, nella direzione che scegli. L'area diventa terreno difficile. Una creatura che si trova completamente dentro la nube ha svantaggio sui tiri per attacco e subisce 1d8 danni da veleno a inizio turno. Una creatura che entra nella nube o termina il turno dentro subisce il danno."},
{n:"Soffio di Gelo",nE:"Cone of Cold",liv:5,sc:"Evocazione",ct:"1 azione",rg:"Te stesso (cono di 60 piedi)",comp:"V, S, M",dur:"Istantanea",con:false,
 desc:"Un getto di ghiaccio gelido esplode dalla tua mano in un cono di 60 piedi. Ogni creatura nel cono deve superare un tiro salvezza sulla Destrezza, subendo 8d8 danni da freddo su un fallimento, o metà su un successo. Il gelo crea terreno difficile sul terreno di superficie gelata per 1 minuto."},
{n:"Palla di Fuoco",nE:"Fireball",liv:3,sc:"Evocazione",ct:"1 azione",rg:"150 piedi",comp:"V, S, M",dur:"Istantanea",con:false,
 desc:"Una scia di luce parte dal tuo dito puntato verso un punto nella portata e esplode in un'onda di fiamme. Ogni creatura in una sfera di raggio 20 piedi deve superare un tiro salvezza sulla Destrezza, subendo 8d6 danni da fuoco su un fallimento, o metà su un successo. Il fuoco circonda gli angoli e infiamma gli oggetti combustibili non indossati."},
{n:"Fiamma",nE:"Fire Wall",liv:4,sc:"Evocazione",ct:"1 azione",rg:"120 piedi",comp:"V, S, M",dur:"1 minuto (concentrazione)",con:true,
 desc:"Crei un muro di fuoco su una superficie solida entro la portata: un muro lineare di 40 piedi per 15 piedi di altezza, o un muro a quadrato di 20 piedi per lato e 20 piedi di altezza. Il muro dura fino alla fine. Una creatura che inizia o termina il turno nell'area subisce 5d8 danni da fuoco. Una creatura all'interno del muro subisce 5d8 quando vi entra e 5d8 a inizio turno."},
{n:"Polimorfa",nE:"Polymorph",liv:4,sc:"Mutazione",ct:"1 azione",rg:"60 piedi",comp:"V, S, M",dur:"1 ora (concentrazione)",con:true,
 desc:"Una creatura che puoi vedere e toccare viene trasformata in una bestia con CR pari o inferiore al suo livello (o al tuo, se sei più debole). Le statistiche sono sostituite da quelle della nuova forma: la creatura non può parlare, leggere, scrivere o compiere azioni che richiedano le mani. Qualsiasi equipaggiamento che indossa o porta viene assorbito dalla nuova forma. I danni non recuperati restano quando torna alla forma originale."},
{n:"Banimento",nE:"Banishment",liv:4,sc:"Abiurazione",ct:"1 azione",rg:"60 piedi",comp:"V, S, M",dur:"1 minuto (concentrazione)",con:true,
 desc:"Punti a una creatura entro la portata. Se è una creatura extra-pianare, viene immediatamente scagliata nel suo piano di origine. Altrimenti, deve superare un tiro salvezza sulla Saggezza, altrimenti viene scagliata in un piano di demilimo (o in un altro piano scelto dal DM). Lì resta invisibile e incapace di agire finché dura; alla fine, torna nel luogo in cui era (se non c'è più spazio, appare nel punto più vicino libero)."},
];

/* --- Biomi: meteo ed eventi di viaggio (generatore procedurale) --- */
const L_BIOMI = {
foresta:{nome:"Foresta",icon:"🌲",
 meteo:["Mattino caldo e nebbioso","Pioggia leggera che filtra dalle foglie","Giorno afoso, aria immobile","Nebbia fitta","Temporale con tuoni lontani","Sole forte e tiepido","Sera fresca e limpida","Raffiche di vento che scuotono i rami"],
 eventi:["Il sentiero è sparito: gli alberi sembrano essersi chiusi, e ogni punto di riferimento è nel posto sbagliato.",
 "Una processione di cervi bianchi attraversa la strada in silenzio. L'ultimo si ferma e guarda il gruppo dritto negli occhi.",
 "Accampamento ancora caldo: tre tazze, un coltello, e una scarpa da bambino abbandonata accanto al fuoco.",
 "Un ramo cade, e dalla chioma una voce che non è di uccello chiede a voce roca: 'Avete un nome? Ne sto raccogliendo.'",
 "Il ruscello che state attraversando ha cambiato corso: adesso scorre nella direzione sbagliata.",
 "Un albero enorme si è spaccato, rivelando una camera vuota con un tavolo di pietra e intagli che sembrano avvertimenti.",
 "Le ombre del gruppo si muovono con un secondo di ritardo. Per un momento. Poi tutto torna normale.",
 "Un carro abbandonato tra le felci: pieno di merci, ma le ruote sono state segate via.",
 "Spore cadono come neve. Chi le inspira nel sonno sognerà una foresta che non è questa.",
 "Un bambino piccolo appare tra gli alberi tenendo una bambola fatta di radici. Non piange, cammina solo avanti.",
 "La capanna del boscaiolo è vuota, ma la porta è chiusa dall'interno e il fuoco è ancora acceso.",
 "Un branco di lupi circonda l'accampamento a distanza di sicurezza, come se aspettassero che qualcuno uscisse."]},
deserto:{nome:"Deserto",icon:"🏜️",
 meteo:["Sole cocente","Caldo che fa tremare l'orizzonte","Vento di sabbia in avvicinamento: il cielo diventa giallo","Notte fresca e stellata","Raffiche secche di sabbia","Vento caldo che porta sabbia","Giorno bianco di luce","Afa che piega l'aria"],
 eventi:["L'oasi sulla mappa non c'è. Al suo posto, un pozzo con una corda nuova — e la corda sale, non scende.",
 "Al tramonto la sabbia 'canta': un basso ronzio ritmico viene dalle dune, come un respiro.",
 "Una carovana di cammelli marcia in file perfette. Nessun conducente. Nessun fantino.",
 "Un mercante offre acqua a prezzo onesto. Il prezzo: 'un ricordo vero, da pagare alla consegna.'",
 "Le orme nella sabbia sono umane, ma chi le ha lasciate era troppo alto: i passi sono larghi due metri.",
 "Una frana blocca il passo. Dietro la roccia, una porta sigillata con un simbolo intagliato: un sole dagli occhi chiusi.",
 "Le pelli d'acqua sono piene, ma l'acqua sa di sale. La mappa dice che il mare è a più di un centinaio di leghe.",
 "Di notte le stelle formano costellazioni che non esistono in nessun atlante, e ci restano tutta la notte.",
 "Un miraggio vi guida a una fortezza in rovina. La fortezza non è un miraggio: il cibo dentro è ancora caldo.",
 "Un temporale di sabbia arriva a gran velocità, non strisciando: viene dritto verso il gruppo, ed è veloce.",
 "Uno scheletro regge una mappa. La mappa mostra la zona in cui vi trovate, e c'è una croce rossa sul vostro accampamento.",
 "Un vecchio vi offre da bere in un'anfora d'argilla. 'Bevi e la sabbia vi amerà. Rifiutate e la sabbia si ricorderà dei vostri volti.'"]},
montagne:{nome:"Montagne",icon:"⛰️",
 meteo:["Aria sottile e gelida","Nebbia bassa sui passi","Neve pesante","Cielo limpido e freddo pungente","Vento tagliente sui valichi","Neve leggera con vento forte","Cielo grigio con i primi fiocchi","Sole che brucia sulla neve"],
 eventi:["Il sentiero in salita è bloccato da una valanga 'di ieri': la neve è ancora in movimento.",
 "Rovine di un accampamento congelato a metà del pasto: i piatti pieni, e il fuoco ancora leggermente acceso.",
 "Un ponte di corde ghiacciate attraversa il vuoto. L'iscrizione sui pali: 'Uno alla volta. Nessuno parla.'",
 "Un mulo offre di guidarvi al passo per qualche moneta. Rifiuta di alzare lo sguardo: 'Meglio se non vedete i miei occhi. Il ghiaccio li vede.'",
 "Un'eco risponde alle vostre parole prima che le pronunciate. E l'eco sbaglia: risponde a qualcosa che non avete ancora chiesto.",
 "Una slavina blocca il valico: una parete di ghiaccio trasparente con qualcosa intrappolata dentro. Qualcosa di grosso.",
 "L'ombra della montagna si muove al momento sbagliato: per un'ora punta a sud, anche se il sole è a est.",
 "Trovi una stazione di posta con un cartello: 'Ultima stazione, 40 miglia.' Siete all'ultima stazione. È del 1200.",
 "Un pastore guida un gregge attraverso il passo. Le pecore sono calme. Non c'è nessun pastore. Il bastone cammina da solo.",
 "La neve comincia a cadere verso l'alto. Per tre minuti. Poi smette, e il respiro di tutti diventa bianco.",
 "Una crepa si apre nella roccia con un respiro profondo: la montagna 'inspira', e l'aria viene risucchiata dentro.",
 "Orme nella neve fresca: umane, scalze, che conducono al bordo del dirupo. Non tornano indietro."]},
sotterranei:{nome:"Sotterranei",icon:"🕳️",
 meteo:["Aria secca e immobile","Goccia d'acqua continua dal soffitto","Lieve odore di zolfo","Corrente d'aria calda che sale","Corrente fredda e umida","Silenzio così denso da essere quasi assordante","Echi che tornano mutati","Muffa che brilla debolmente nel buio"],
 eventi:["Il corridoio che avete chiuso alle vostre spalle non c'è più: la pietra liscia e intera.",
 "L'acqua gocciola dal soffitto con un ritmo perfetto, come un battito lento. Il ritmo cambia quando il gruppo smette di muoversi.",
 "Una forgia ancora calda, con incudine e utensili. Nessun nano, nessun gobolino, nessuno. Solo l'odore del ferro.",
 "Il tunnel si divide in tre. A sinistra, un'avvertimento intagliato: 'Due di noi sono andati a sinistra. Uno è tornato. Non era più lui.'",
 "Un fiume scorre in silenzio sotto terra. L'acqua è nera, e il tuo riflesso si muove un momento dopo di te.",
 "Le pareti sono coperte di tacche: migliaia. Poi, in un'altra mano, la parola: 'Smetti di contare.'",
 "Un accampamento di una spedizione precedente. Il diario dice: 'Giorno 40: sta dormendo. Giorno 41: ha i nostri volti.'",
 "Una porta con un pomello: una mano di bronzo. Quando il gruppo si avvicina, la mano comincia a bussare dall'interno.",
 "L'aria diventa calda e umida, e la pietra è ricoperta di uno strato sottile di sale: qualcuno piange qui da molto tempo.",
 "Senti passi sopra la tua testa: molti, lenti, in cerchio. Girano da ore.",
 "Una scala conduce in basso. Una seconda scala, accanto alla prima, conduce in basso. Una delle due porta in alto, ma entrambe sembrano scendere.",
 "Nella stanza più profonda c'è uno specchio. Lo specchio mostra la stanza come era: il gruppo non c'è. Qualcos'altro c'è."]},
mare:{nome:"Mare",icon:"⚓",
 meteo:["Mare calmo, senza vento","Brezza moderata da nord","Nebbia di mare fitta","Schiarite e piogge di passaggio","Onde alte e lunghe","Vento in aumento, mare bianco","Notte senza stelle, mare calmo","Vento caldo che porta l'odore di terra lontana"],
 eventi:["La nebbia arriva così fitta che si vedono i remi della nave davanti. La nave non è su nessuna carta. Nessuno risponde.",
 "Un branco di delfini nuota in cerchio intorno alla nave. Al centro del cerchio non c'è niente. O non c'era niente.",
 "Un'àncora cade da sola in acque basse: nessuno l'ha toccata, e la catena non c'è.",
 "Una luce galleggia a distanza. Quando vi avvicinate, si spegne. Quando girate, si riaccende.",
 "Le reti tornano piene: i pesci sono morti, e nelle loro bocche ci sono monete — tutte di un regno caduto da un secolo.",
 "Il vento si ferma del tutto. Le vele penzolano, e dal mare viene un suono come un coro che sfarfalla a bassa voce.",
 "La nave passa su una secca dove, per un momento, compaiono gli alberi di una flotta. Sprofondano di nuovo senza un'onda.",
 "Una balena emerge e il suo occhio, grande come uno scudo, guarda dritto il capitano. Poi si immerge, e il mare diventa scuro.",
 "Qualcuno bussa sul fondo della nave. Ritmicamente. Come un messaggio in codice.",
 "La bussola gira per un'ora. Quando si ferma, punta alla terra più vicina — che è da dove siete appena venuti.",
 "La pioggia comincia a cadere, ma è calda e sa di miele. Il mare dove cade diventa calmo e limpido, rivelando cosa c'è sul fondo.",
 "All'alba, la marea lascia sulla spiaggia una fila di oggetti: uno stivale, una lettera, un bambolotto da bambino. Tutti rivolti verso l'interno. Tutti molto nuovi."]},
pianura:{nome:"Pianura",icon:"🌾",
 meteo:["Giorno limpido e ventoso","Polvere all'orizzonte","Temporale improvviso","Caldo afoso e vento secco","Mattina fresca con nebbia bassa","Cielo con un muro di nuvole in avvicinamento","Pioggia leggera e tiepida","Sera calda, piena di stelle"],
 eventi:["La strada si divide in sette direzioni: sette rotture, tutte fresche, tutte nella stessa direzione di marcia.",
 "Un mulino a vento gira senza vento, e sull'erba attorno il grano è tagliato in cerchi perfetti.",
 "Un campo di raccolti che crescono a testa in giù: radici in cielo, spighe nella terra. Sa di dolce.",
 "Un gregge attraversa la strada a passo fermo. Al centro del gregge c'è un vitello nero: vi sta guardando, e conosce il vostro nome.",
 "L'orizzonte è perfettamente dritto, e in lontananza c'è una torre. Dopo due ore, la torre è alla stessa distanza.",
 "Un contadino offre rifugio e cibo. La tavola è apparecchiata per molti, ma è solo. 'Arrivano,' dice, e sorride.",
 "L'erba si apre in una linea che porta dritto nel mezzo della pianura. Seguitela, e l'erba si chiude dietro di voi.",
 "Al tramonto il cielo diventa rosso — troppo rosso. E in quel rosso, per un momento, qualcosa con le ali lo attraversa.",
 "Una fonte con un secchio nuovo. Il secchio è pieno di monete. Nessuno vive entro un miglio.",
 "Il vento comincia a sussurrare nomi. Tutti i nomi che i membri del gruppo hanno mai avuto. Inclusi quelli che hanno dimenticato.",
 "La strada è bordata da pietre miliari: tutte numerate '1'. I numeri scendono, e passate la stessa pietra di nuovo.",
 "Un aquilone da bambino si impiglia in una siepe. Tagliate il filo, e l'aquilone sale e vola verso l'interno, contro il vento."]},
gelido:{nome:"Terra Gelida",icon:"❄️",
 meteo:["Freddo pungente e cielo limpido","Vento gelido","Nebbia di aria congelata","Neve con vento forte da nord","Calma di vetro, temperatura in calo","Primi fiocchi della stagione","Vento gelido che penetra nelle ossa","Notte con stelle più brillanti del solito"],
 eventi:["Il fuoco del campo si congela: le fiamme diventano ghiaccio azzurro e mantengono la loro forma. Il freddo non si allontana.",
 "Orme nella neve: le vostre. In avanti, da questo stesso accampamento, verso un luogo che non avete ancora raggiunto.",
 "Un lago ghiacciato, perfettamente piatto, con un foro di ghiaccio al centro. Sotto il ghiaccio, una luce sale e cala, come un battito.",
 "Un orso polare guarda da lontano senza avvicinarsi: non sta cacciando, sta proteggendo qualcosa. Qualcos'è ai suoi piedi.",
 "L'aurora forma un volto nel cielo. Il volto guarda il gruppo dall'alto e inclina la testa, in ascolto.",
 "Una slitta per cani, le tracce ancora calde. Nessun cane. Nessun conducente. La slitta è piena di carne fresca.",
 "Il freddo è così intenso che il respiro si trasforma in piccoli cristalli che cadono come neve al contrario: neve che sale dal suolo.",
 "Una grotta di ghiaccio si apre da sola: aria calda ne esce, e dentro c'è un piccolo giardino in fiore, in pieno inverno.",
 "Il ghiaccio scricchiola e 'sospiro', e per un momento il gruppo può sentire una voce che dice una sola parola: 'Non ancora.'",
 "Attraversate un ponte di ghiaccio su un ghiacciaio: dall'altra parte c'è un accampamento. È il vostro: le vostre tende, il vostro equipaggiamento. Nessuno dentro.",
 "La neve cade in una spirale perfetta intorno al gruppo, e la bussola punta verso il cielo.",
 "Un viaggiatore in pellicce complete offre di camminare con voi: è caldo, amichevole, e la sua ombra cade nella direzione sbagliata — e non ha ombra."]},
citta:{nome:"Città",icon:"🏰",
 meteo:["Pioggia sui tetti","Nebbia che entra dal fiume","Caldo soffocante","Notte di lanterne e lampioni","Rovescio improvviso","Mattina fredda, strade bagnate","Sera tiepida, mercati che chiudono","Cielo pieno di fumo dai camini"],
 eventi:["Il mercato chiude prima dell'ora, e gli stand vengono smontati in fretta. I mercanti non dicono il perché: solo 'la campana.'",
 "Una campana suona nella cattedrale, ma la campana è chiusa da un secolo. E nella torre non c'è nessuno.",
 "Un manifesto con il volto di uno dei PG. Il reato: 'Tradimento.' La ricompensa: 'Silenzio.'",
 "Il guardiano alla porta fa passare il gruppo senza una parola, e i suoi occhi sono fissi su un punto appena a sinistra della vostra spalla.",
 "Un bambino corre tra la folla gridando: 'Il pozzo parla!' I adulti distolgono lo sguardo.",
 "L'osteria frequentata è piena, e ogni tavolo ha una figura di sale: gli avventori ci sono, ma 'di sale.'",
 "Una processione passa in silenzio: bende bianche, candele nere. Nella processione c'è un feretro vuoto, e i barellieri camminano all'indietro.",
 "La città ha un coprifuoco notturno, e al tramonto una porta che non c'era prima appare nel muro del vicolo in cui vi trovate.",
 "Siete seguiti: tre passi dietro di voi, tutto il giorno. Ogni volta che vi fermate, il seguace si ferma. Ogni volta che girate, vedete solo la strada vuota.",
 "L'acquaiolo porta l'acqua in un secchio vecchio: l'acqua dentro è perfettamente immobile, anche quando il secchio si inclina.",
 "Un mercante vende 'souvenir dal futuro': una moneta di un regno che non esiste ancora, una lettera in una calligrafia che riconoscete.",
 "In piazza, una folla si è radunata intorno a qualcosa sotto un panno bianco. Vi avvicinate, e il panno si muove in un vento che non c'è — e la folla si fa da parte, come se vi stesse aspettando."]}
};

/* --- Generatore di PNG: pool procedurale --- */
const NOMI_M = ["Aldric","Bram","Corrado","Drago","Ettore","Fausto","Giano","Idris","Lupo","Maro","Nardo","Odo","Piro","Quinto","Rinaldo","Sgarbi","Tancredi","Ugo","Valdo","Zeno","Berto","Ciro","Elio","Flavio","Hrothgar","Isidoro","Leodegar","Malvo","Norberto","Ottavio","Poldo","Ramiro","Sisto","Tazio","Uberto","Vassago","Zeffiro","Brand","Grato","Rocco"];
const NOMI_F = ["Alina","Berta","Cinzia","Dagna","Edda","Felicia","Greta","Hilda","Iole","Jorunn","Katia","Livia","Malva","Nana","Odessa","Pia","Quirina","Rosa","Sera","Tilda","Ursa","Vesta","Wanda","Zelma","Amalia","Bruna","Cressida","Desirée","Elfrida","Freja","Gisela","Grimhilda","Isolde","Katrín","Loira","Meera","Nerina","Ophelia","Ragnhild","Svea"];
const COGNOMI = ["Denteferro","Cuorinverno","Neri","Bracciadargento","Piumabianca","Macchiadombra","Torchiabassa","Fogliarossa","Ventoalato","Roccamarina","Il Grifone","Serpepelli","Fiammabrezza","Lunafredda","Tondorosso","Aquilone","Pietranera","L'Argento","Corvino","Salvia","Bramante","Il Drago","Falco","Il Gatto","Lupo","Il Martello","Navetta","Occhio","Pietra","Rame"];
const RAZZE_NPC = ["Umano","Mezzelfo","Elfo Alto","Elfo Sylvestre","Drow","Nano delle Colline","Nano della Montagna","Gnome delle Roccie","Svirfneblin","Halfling","Tifling","Aasimar","Genasi del Fuoco","Genasi dell'Aria","Orco","Dragonborn"];
const CORPI_NPC = ["alto e magro","basso e robusto","esile come un'ombra","imponente","sottile","dai muscoli taurini","dalla postura rigida e attenta"];
const DETTAGLI_NPC = ["una cicatrice che gli attraversa il sopracciglio","le mani ruvide da duro lavoratore","occhi che cambiano colore con la luce","un tatuaggio sbiadito sul collo","le unghie spezzate, come di chi ha lottato troppo","un sorriso perpetuo","la voce roca di chi ha gridato in battaglia","profuma di zolfo e incenso","un mantello scuro e strappato","i capelli intrecciati con perline d'osso"];
const TRATTI_NPC = [
"Sorride a tutti, ma i suoi occhi controllano sempre le uscite.",
"Conta le monete ad alta voce, anche quando non ne ha.",
"Rifiuta di alzare la voce, nemmeno in mezzo a una battaglia.",
"Porta sempre con sé un piccolo vial di sangue di qualcuno.",
"Non entra mai in case con la porta bianca.",
"Menzogna facilmente, ma aggiunge sempre un dettaglio vero per rendere la menzogna credibile.",
"Parla alla propria ombra, come a un confidente.",
"Non accetta mai monete da bambini o anziani.",
"Sente di zolfo e incenso di qualità scadente.",
"Conosce i soprannomi di ogni taverna e li usa senza fallo.",
"Mormora un'antica ninna nanna mentre lavora; non dice mai perché.",
"Ha un tatuaggio a metà cancellato sull'avambraccio: una luna crescente con una stella in meno.",
"Non tira mai la lama contro chi gli ha offerto cibo.",
"Ripete a sé stesso una frase: 'Prima della marea.'",
"Offre aiuto agli sconosciuti, ma mai gratis: chiede sempre una storia.",
"Tocca l'impugnatura della sua arma ogni volta che attraversa una soglia.",
"Ride delle sue stesse battute, spaventando le persone.",
"Scrive lettere a qualcuno che non esiste più.",
"Non mangia carne la notte della luna nuova.",
"Si siede sempre di fronte alla porta.",
"Sfrega il motivo di un gioco per bambini; i bambini smettono di giocare quando lo sentono.",
"Vende a buon prezzo, ma rifiuta il contraccambio: 'Il prezzo è il prezzo.'",
"Ha una cicatrice attraverso la bocca e dice che è da un bacio sbagliato.",
"Si ricorda il compleanno di tutti e manda un messaggio senza chiedere."];
const IDEALI_NPC = [
"ONORE: 'Una parola data è una catena, anche se fa male.'",
"FAMIGLIA: il sangue conta tutto; il resto è moneta.",
"RIVINCITA: vive per il giorno in cui guarderà il suo nemico negli occhi.",
"FEDE: serve un dio, e il dio manda sempre messaggi.",
"ORO: fidatevi solo di ciò che si può tenere in mano e contare.",
"GIUSTIZIA: la legge è una menzogna; lui fa giustizia sua.",
"RISARCIMENTO: vuole riscattare un debito di sangue.",
"LIBERTÀ: preferisce mendicare libero che vivere in gabbia.",
"CONOSCENZA: ogni segreto ha un prezzo, ed è disposto a pagarlo.",
"SOPRAVVIVENZA: ha visto troppa gente morire per il 'bene maggiore'.",
"CURIOSITÀ: morirebbe per sapere cosa c'è dietro la porta.",
"DOVUTE: il giuramento al suo ordine è sacro.",
"AVARIZIA: 'I morti portano il loro tesoro nella terra.'",
"AMORE: c'è un nome che non pronuncia mai, e brucerebbe il mondo per proteggerlo.",
"PROPRIETÀ: non è orgoglioso — è solo corretto.",
"VENDETTA DEI MORTI: le tombe che custodisce sono piene di nomi.",
"SPERANZA: crede in una città che non esiste ancora.",
"PAURA: fa tutto ciò che fa per tenere alla porta un ricordo.",
"MISTERO: 'Ciò che è nascosto è mio.'",
"LEALTÀ: è stato comprato una volta. Non succederà mai più.",
"AMBIZIONE: la sedia più in alto è vuota, e le sue mani pruderebbero.",
"PACE: venderebbe la sua spada se potesse comprare silenzio.",
"RITUALE: l'ordine è l'unico muro contro il caos.",
"MEMORIA: raccoglie gli oggetti dei morti, così i morti non muoiono due volte."];
const SEGRETI_NPC = [
"È l'ultimo sopravvissuto di una carovana distrutta tre anni fa — e il rapporto ufficiale dice che 'nessuno è sopravvissuto'.",
"Vende informazioni a due fazioni rivali, contemporaneamente.",
"Suoi fratelli e sorelle sono scomparsi, e sono diventati il suo peggior nemico.",
"Ha fatto un patto con qualcosa che ancora pretende un debito da lui.",
"La lettera che scrive ogni mese è per la persona che lo ha condannato a morte.",
"Sà dov'è nascosto il vero tesoro — non quello che tutti stanno cercando.",
"La malattia che dice di avere è inventata: in realtà nasconde una maledizione.",
"È il figlio illegittimo della famiglia più potente della città, e la famiglia lo sa.",
"L'oggetto che non toglie mai è una chiave — ma nessuno sa a quale porta.",
"Ha tradito la propria gilda per salvarsi la vita. La gilda esiste ancora.",
"Nelle notti limpide parla alla luna: la voce del suo vecchio padrone risponde, e diventa più arrabbiata.",
"Il veleno che usa sui nemici è fatto dallo stesso antidoto che ha venduto al tempio.",
"Non ricorda gli ultimi cinque anni: la sua memoria è stata comprata da qualcuno.",
"L'orfano che protegge non è un orfano: è l'erede al trono.",
"Sta facendo la guardia a un certo avventuriero, e sta venendo pagato per farlo — e quell'avventuriero è uno dei PG.",
"Il tempio che lo ha cresciuto non esiste più: l'ha bruciato lui, e sa solo lui perché.",
"La sua ombra si muove mezzo secondo in ritardo, e cerca di nasconderlo.",
"Porta un contratto con il suo nome: non sa a chi è stato venduto.",
"Il bambino che ha salvato dal fiume lo segue adesso, e non smetterà di seguirlo.",
"Ha già ucciso qualcuno per questo lavoro. Sta fingendo di non saperlo.",
"L'anello che indossa è una prigione per qualcosa che dorme.",
"Conosce la password della cassaforte sigillata, e la cassaforte è vuota.",
"Ogni luna piena qualcuno gli paga per non fare qualcosa. Non sa qual è quel 'qualcosa'.",
"La sua prima parola come oratore è stata 'attenti', e da allora è sempre andata a buon fine."];
const AGGIANCI_NPC = [
"Cerca un certo oggetto d'antiquariato che è riemerso di recente sul mercato nero.",
"Pagherebbe bene per far consegnare un certo messaggio a una persona che non vuole riceverlo.",
"Chiede ai PG di tenere d'occhio qualcuno di notte; quella persona è in pericolo — o è il pericolo in persona.",
"Sa la posizione esatta di un ingresso segreto nella città sotterranea, e lo condivide solo per un favore.",
"Si unisce al gruppo per un solo giorno: dice di avere un affare urgente in città.",
"Ha visto qualcosa che nessun altro ha visto: lo stesso volto in due folle distanti.",
"Sa distinguere una vera contraffazione tra documenti che sembrano ufficiali; uno di quei documenti è nelle mani dei PG.",
"Stà essendo seguito e non sa da chi; chiede ai PG di scoprirlo.",
"Vuole comprare una nave: dice che è per il commercio, ma sta imballando armi.",
"Offre ai PG un lavoro: vegliare su un magazzino per una notte. Il magazzino è vuoto. Al momento.",
"Nasconde un bambino che dovrebbe essere morto tre giorni fa.",
"Vende ai PG una mappa senza una destinazione segnata — solo date.",
"È disposto a rivelare un segreto della famiglia al potere, ma solo se promettono di non uccidere chi lo possiede.",
"Ha ricevuto tre inviti identici per la stessa notte: tre manieri diversi.",
"Chiede ai PG di distruggere una lettera; lui stesso ha troppa paura di leggerla.",
"Conosce un rito per curare una piaga, ma la lista degli ingredienti include qualcosa di impossibile da ottenere.",
"È l'unico che sa leggere l'iscrizione su un monumento verso cui il gruppo sta andando.",
"Si finge un semplice mercante, ma ha l'aria di un nobile esiliato.",
"Offre una stanza nella sua casa gratis, con una condizione: non aprire mai la porta con il pugno nero.",
"Vuole che i PG portino un dono a qualcuno di morto — nella sua tomba, a mezzanotte.",
"Ha perso il ricordo di un giorno specifico, e i dettagli che ricorda sono sbagliati.",
"Cerca un bardo: non un bardo qualunque, un certo, che canta una certa canzone.",
"Vende ai PG un oggetto 'maledetto' a un prezzo molto basso. È davvero maledetto. Lui però non lo sa.",
"Ha una confessione da fare prima di morire: ha bisogno che i PG la sentano e poi la dimentichino."];
const FRASI_NPC = [
"In questa città tutti vendono qualcosa. La domanda è: cosa stai comprando tu?",
"Io non chiedo il passato. Il passato chiede sempre di essere pagato.",
"Tre monete e saprai un segreto. Quattro, e smetterò di ricordarlo.",
"I morti non mentono. Ma non parlano nemmeno, ed è peggio.",
"Ero qui prima che avessimo un nome, e sarò qui dopo che avremo perso il nome. Questo è tutto ciò che sono.",
"La fiducia è un lusso. Pagala.",
"Hai la faccia di chi sta per fare un errore. Congratulazioni.",
"Quando la campana batte tredici volte, ricordati di chi te l'ha detto.",
"Il prezzo è il prezzo. Il prezzo è sempre il prezzo.",
"Tengo la mia parola come una lama: affilata, e vicina a me.",
"Guarda la porta dietro di te. Io la guarderei anche.",
"Un accordo è un accordo, anche se brucia.",
"Il mare alla fine prende tutto. Anche le promesse.",
"Ho fatto cose peggiori di quelle che mi stai chiedendo. Ma anche cose migliori. Oggi scelgo il male minore.",
"Se vuoi la verità, portami qualcosa che non ho ancora visto.",
"La luna è in una buona posizione. Per te, direi, in una cattiva.",
"Vendo ombre. Oggi ne consegno una a te.",
"I miei nemici hanno tombe, i miei amici hanno nomi. Tu non sei ancora nessuno dei due: scegli.",
"Cosa è successo quella notte, te lo dirò. Ma pagherai con il silenzio.",
"Tutti hanno una porta che non aprono. La mia è in cantina. La tua?"];

/* --- Generatore di bottino (ispirato alle tabelle del DMG 5e; oggetti del SRD, OGL) --- */
const LOOT_MONETE = {
 "0-4":  [["3d6","cp"],["2d4","sp"],["1d2","gp"]],
 "5-10": [["5d6","cp"],["4d4","sp"],["2d4","gp"]],
 "11-16":[["1d6","sp"],["4d4","gp"],["1d2","pp"]],
 "17+":  [["2d4","gp"],["3d4","pp"]]
};
const LOOT_VALORI = { cp:0.01, sp:0.1, gp:1, pp:100 };
const LOOT_NOMI = { cp:"monete di rame", sp:"monete d'argento", gp:"monete d'oro", pp:"monete di platino" };
const LOOT_TIERS = {
 comune:  ["Pozione di guarigione","Pozione di cura malattie","Pozione di amicizia con gli animali","Pozione di invisibilità","Pozione di respirare sott'acqua","Scrollo di fermare persona","Bacchetta di rilevamento magia","Bacchetta di ragnatela","Zaino di componentistica magica","Strumento musicale incantato"],
 noncomune:["Pozione di guarigione maggiore","Scrollo di palla di fuoco","Bacchetta di fuoco","Bacchetta di frecce magiche","Bacchetta di paralisi","Spada +1","Guanti di destrezza","Olio d'ombra"],
 raro:    ["Bastone di guarigione","Bacchetta della magia di guerra","Bastone di tuono"]
};
const LOOT_VAL_TIERS = { comune:25, noncomune:200, raro:2000 };

/* --- LLM: provider e modelli di default (tutti con piano gratuito) --- */
// Nota: l'elenco dei modelli ":free" di OpenRouter ruota di mese in mese;
// l'app carica l'elenco ATTUALE direttamente da OpenRouter (vedi scheda Impostazioni).
const LLM_DEFAULT_MODEL = {
 openrouter: "google/gemma-4-31b-it:free",
 groq: "llama-3.3-70b-versatile",
 huggingface: "mistralai/Mistral-7B-Instruct-v0.2"
};
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

/* --- Elenco modelli gratuiti attuali (OpenRouter: API pubblica; Groq: con chiave) --- */
async function listaModelliFree(provider, key){
  if (provider === "openrouter"){
    const j = await gmFetchJSON("https://openrouter.ai/api/v1/models", {timeout:12000});
    const arr = Array.isArray(j) ? j : (j.data || []);
    const out = [];
    for (const m of arr){
      const id = m.id || "";
      if (!id.endsWith(":free")) continue;
      const arch = m.architecture || {};
      const inp = (arch.input_modalities || []).join(",");
      const outm = (arch.output_modalities || []).join(",");
      if (!/text/.test(inp) || !/text/.test(outm)) continue;
      if (/embedding|rerank|tts|transcribe|speech|caption/i.test(id)) continue;
      const ctx = m.context_length ? " · " + Math.round(m.context_length/1000) + "K ctx" : "";
      out.push({ id, nome: (m.name || id) + ctx });
    }
    return out.sort((a,b)=>a.id.localeCompare(b.id));
  }
  if (provider === "groq" && key){
    const j = await gmFetchJSON("https://api.groq.com/openai/v1/models", {timeout:12000, headers:{Authorization:"Bearer "+key}});
    return (j.data || []).map(m=>({id:m.id, nome:m.id})).sort((a,b)=>a.id.localeCompare(b.id));
  }
  return null;
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
      <p class="adm-hint" style="border:1px dashed rgba(84,194,136,.35);border-radius:7px;padding:6px 8px">🔒 La chiave resta solo nel browser (memoria di Tampermonkey). Viene inviata solo al provider che scegli tu, quando premi un bottone di generazione.</p>
      <p class="adm-hint">Fonte mostri: <span id="st-fonte">—</span> · SRD 5.1 (OGL 1.0a)</p>
      <div class="adm-row"><button class="adm-btn" id="st-ricarica">🔄 Ricarica dati mostri</button></div>
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
function salvaInit(){ GM_setValue("adm_iniziativa", JSON.stringify(init)); }
try{
  const salv = GM_getValue("adm_iniziativa","");
  if (salv){ const j = JSON.parse(salv); if (Array.isArray(j.lista)) init = j; }
}catch(e){}

function aggiungiCombattente(nome, val, daChat){
  nome = String(nome||"").trim();
  val = +val;
  if (!nome || isNaN(val)) return false;
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
  }
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
    if (d20 && nome && !nomiRecenti.slice(-15).includes(nome)){
      nomiRecenti.push(nome);
      aggiornaSelectNomi();
    }
    // 2) tiro di INIZIATIVA (parola "iniziativa"/"initiative" nel messaggio o nella formula)
    if (tot != null && !isNaN(tot) && /iniziattiv|initiative/.test(bundle)){
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
        if (node.id === "adm-panel") continue;
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
function getParty(){ try{ return JSON.parse(GM_getValue("adm_party","[]")); }catch(e){ return []; } }
function renderParty(){
  const p = getParty();
  $("pg-lista").innerHTML = p.length
    ? "PG: " + p.map(x=>`${esc(x.nome)} (liv ${x.liv})`).join(" · ")
    : "Nessun PG salvato.";
}
$("pg-salva").addEventListener("click", ()=>{
  const nome = $("pg-nome").value.trim();
  const liv = clamp(+$("pg-liv").value || 0, 1, 30);
  if (!nome || !liv){ toast("Nome e livello"); return; }
  let p = getParty();
  const es = p.find(x=>x.nome.toLowerCase() === nome.toLowerCase());
  if (es) es.liv = liv; else p.push({nome, liv});
  GM_setValue("adm_party", JSON.stringify(p));
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
   PNG
   ============================================================ */
$("np-gen").addEventListener("click", async ()=>{
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
    box.innerHTML = `<div class="adm-res"><div class="t">🎭 PNG</div>${esc(testo)}</div>`;
    const t = testo;
    const b = document.createElement("button");
    b.className = "adm-btn"; b.style.marginTop = "8px"; b.textContent = "📋 Copia";
    b.onclick = ()=>{ if (copiaTesto(t)) toast("PNG copiato"); else toast("Copia non riuscita"); };
    box.appendChild(b);
  }catch(e){
    if (usaLLM){
      const testo = generaPNGProc();
      box.innerHTML = `<div class="adm-hint">⚠️ LLM non raggiungibile (${esc(e.message)}) — uso procedurale</div><div class="adm-res"><div class="t">🎭 PNG</div>${esc(testo)}</div>`;
    } else box.innerHTML = `<div class="adm-hint">Errore: ${esc(e.message)}</div>`;
  }
});

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
  const s = GM_getValue("adm_biome","");
  if (s && L_BIOMI[s]) sel.value = s;
  sel.addEventListener("change", ()=>GM_setValue("adm_biome", sel.value));
})();
$("ev-gen").addEventListener("click", async ()=>{
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
    box.innerHTML = `<div class="adm-res"><div class="t">🌩️ ${L_BIOMI[idB].nome}</div>${esc(testo)}</div>`;
    const t = testo;
    const b = document.createElement("button");
    b.className = "adm-btn"; b.style.marginTop = "8px"; b.textContent = "📋 Copia";
    b.onclick = ()=>{ if (copiaTesto(t)) toast("Evento copiato"); else toast("Copia non riuscita"); };
    box.appendChild(b);
  }catch(e){
    if (usaLLM){
      const p = generaEventoProc(idB);
      const testo = "METEO: " + p.meteo + "\nIMPREVVISTO: " + p.evento;
      box.innerHTML = `<div class="adm-hint">⚠️ LLM non raggiungibile (${esc(e.message)}) — uso la tabella</div><div class="adm-res"><div class="t">🌩️ ${L_BIOMI[idB].nome}</div>${esc(testo)}</div>`;
    } else box.innerHTML = `<div class="adm-hint">Errore: ${esc(e.message)}</div>`;
  }
});

/* ============================================================
   IMPOSTAZIONI LLM
   ============================================================ */
function aggiornaModelloWrap(){
  const p = $("st-prov").value;
  $("st-mod").placeholder = p === "nessuno" ? "—" : "Predefinito: " + LLM_DEFAULT_MODEL[p];
  carregaModelliUS();
}
// compila il menu a tendina con i modelli gratuiti ATTUALI
async function carregaModelliUS(){
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
    if (!lista || !lista.length) throw new Error("vuota");
    const salvo = (getLLM().model || "").trim();
    let html = '<option value="__default__">⚡ ' + LLM_DEFAULT_MODEL[prov] + "</option>";
    for (const m of lista) html += '<option value="' + esc(m.id) + '">' + esc(m.nome) + "</option>";
    sel.innerHTML = html;
    if (salvo){ if (lista.some(m=>m.id===salvo)) sel.value = salvo; else $("st-mod").value = salvo; }
  }catch(e){
    sel.innerHTML = '<option value="__default__">⚠️ Elenco non caricato — predefinito (' + LLM_DEFAULT_MODEL[prov] + ")</option>";
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
  aggiornaModelloWrap();
  $("st-stat").textContent = s.key ? "🟢 Chiave salvata (" + s.provider + ")" : "Nessuna chiave salvata.";
}
$("st-prov").addEventListener("change", aggiornaModelloWrap);
$("st-modrl").addEventListener("click", carregaModelliUS);
$("st-salva").addEventListener("click", ()=>{
  GM_setValue("adm_llm", JSON.stringify({
    provider: $("st-prov").value, model: modelloEffettivoUS(), key: $("st-key").value.trim()
  }));
  carregaSettings(); toast("Impostazioni salvate");
});
$("st-test").addEventListener("click", async ()=>{
  const keyT = $("st-key").value.trim();
  const provT = $("st-prov").value;
  if (provT === "nessuno" || !keyT){ toast("Scegli provider e incolla la chiave"); return; }
  GM_setValue("adm_llm", JSON.stringify({ provider:provT, model:modelloEffettivoUS(), key:keyT }));
  $("st-stat").textContent = "⏳ Test in corso…";
  try{
    await chatLLM("Sei un assistente di test. Rispondi solo: OK", "Di' OK.");
    $("st-stat").textContent = "🟢 Connesso! Premi Salva per confermare.";
    toast("Connessione riuscita");
  }catch(e){
    $("st-stat").textContent = "🔴 " + e.message;
    toast("Test fallito");
  }
});
$("st-canc").addEventListener("click", ()=>{
  GM_setValue("adm_llm", "null");
  carregaSettings(); toast("Chiave rimossa");
});
$("st-ricarica").addEventListener("click", async ()=>{
  $("st-fonte").textContent = "caricamento…";
  const okc = await caricaMostriOnline();
  $("st-fonte").textContent = state.fonte + (okc ? " — " + state.mostri.length + " mostri" : "");
  toast(okc ? "Dati online caricati" : "Uso il dizionario locale");
});

/* ============================================================
   AVVIO
   ============================================================ */
carregaSettings();
renderInit();
aggiornaBudget();
renderParty();
caricaMostriOnline().then(okc=>{
  $("st-fonte").textContent = state.fonte + (okc ? " — " + state.mostri.length + " mostri" : "");
});
avviaWatcher();

})();

