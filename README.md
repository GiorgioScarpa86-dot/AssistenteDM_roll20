# ⚔️ Assistente DM — D&D 5e (Roll20)

Assistente AI per Dungeon Master, **pronto all'uso senza programmazione**:
scontri bilanciati, tracciamento iniziativa, PNG coerenti, meteo/imprevisti,
bottino automatico e ricerca mostri/incantesimi dal **SRD 5e** (con fallback
offline incorporato).

## 📦 File del progetto

| File | Descrizione |
|---|---|
| [`assistente_dm.html`](assistente_dm.html) | **App standalone** in un unico file: apri con doppio clic nel browser (stile dark fantasy, responsive, funziona anche offline) |
| [`assistente_dm_roll20.user.js`](assistente_dm_roll20.user.js) | **Script Tampermonkey** che integra l'assistente in un pannello fluttuante dentro Roll20, con lettura automatica della chat per l'iniziativa |
| [`ISTRUZIONI.md`](ISTRUZIONI.md) | **Guida passo-passo** (click per click) per installarla e usarla senza saper programmare |
| [`CODICE_COMPLETO.md`](CODICE_COMPLETO.md) | **Entrambi i blocchi integrali** (HTML e Tampermonkey) da prima a ultima riga, senza segnaposto |

## ✨ Funzionalità

- **Mostri & Regole** — ricerca mostri e incantesimi dal SRD via API pubblica
  (`dnd5eapi.co`, con fonte alternativa `5e-srdapi.com` e un dizionario locale
  incorporato di 26 mostri + 29 incantesimi se offline). Gli scontri usano
  CR/XP locali verificati quando l'indice API non li include.
- **Scontri bilanciati** — budget XP per difficoltà (Facile/Medio/Difficile/
  Mortale) calcolato con le tabelle DMG 5e + generatore di incontri.
- **Iniziativa** — tracciatore ordinato con avanza-turno; nella versione
  Roll20 capta automaticamente i tiri d20 "iniziativa" dalla chat.
- **PNG coerenti** — generatore procedurale in italiano o LLM gratuito
  (OpenRouter / Groq / Hugging Face) con chiave incollata in GUI (mai nel
  codice, salvata solo nel browser).
- **Meteo & Imprevisti** — tabelle per 8 biomi, opzione LLM.
- **Bottino** — monete + oggetti magici del SRD per fascia di CR, con copia
  in un click.

## ⚖️ Licenza dati

Tutti i contenuti di gioco derivano dal **System Reference Document 5.1**
(licenza **OGL 1.0a**, open content). Le tabelle di budget XP seguono il
metodo della Guida del Dungeon Master 5e. Nessun materiale protetto da
copyright è contenuto in questo progetto.

## 🛠️ Nota per sviluppatori

L'app è un unico file HTML con CSS e JS inline (zero dipendenze). Lo script
UserScript è autonomo e usa `GM_xmlhttpRequest` per evitare problemi CORS
sulla pagina di Roll20. Per rigenerare i file dal sorgente modulare vedere
la struttura in `build/` (opzionale).
