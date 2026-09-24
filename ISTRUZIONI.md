# 📖 ISTRUZIONI — Assistente DM per D&D 5e

> **Non sai programmare? Nessun problema.** Questo documento ti guida con i
> click esatti da fare. Ogni istruzione è pensata per essere seguita alla lettera.

---

## 📦 Cosa hai ricevuto

| File | Cos'è | Come lo usi |
|---|---|---|
| **`assistente_dm.html`** | L'App completa in un solo file (funziona anche offline) | Doppio clic per aprirla nel browser |
| **`assistente_dm_roll20.user.js`** | Lo script per Tampermonkey che porta l'assistente dentro Roll20 | Da copiare-incollare in Tampermonkey (vedi Opzione B) |
| **`ISTRUZIONI.md`** | Questo documento | Da leggere 😊 |

**Consiglio:** usa **tutte e due** le opzioni. L'App standalone (Opzione A) è
perfetta per preparare scontri, PNG e bottino *prima* della partita; lo script
Roll20 (Opzione B) è perfetto *durante* la partita, perché legge la chat e
gestisce l'iniziativa al volo.

---

# 🅰️ OPZIONE A — L'App standalone (doppio clic, via)

## Passaggio 1 — Apri l'app
1. Trova il file **`assistente_dm.html`** (dove lo hai salvato).
2. **Doppio clic** su di esso (Windows e Mac).
3. Si aprirà da sola nella tua finestra del browser (Chrome, Edge, Firefox o Safari vanno tutti bene).
4. Fatto. Non si installa niente, non c'è nessun account, nessun server.

> Se il file non si apre col doppio clic: tasto destro → **"Apri con"** → scegli
> il tuo browser (es. Chrome).

## Passaggio 2 — Controlla la fonte dati
In alto a destra c'è una "pillola" di stato:
- **🟢 Fonte: D&D 5e SRD API** → sei online: hai a disposizione l'intero dizionario SRD (334 mostri, tutti gli incantesimi).
- **🔴 Offline — dizionario locale** → non c'è internet (o l'API è giù): l'app usa comunque il dizionario incorporato (27 mostri essenziali + 28 incantesimi). **Tutto funziona comunque.**

## Passaggio 3 — Le 5 schede (in alto)

### 📜 Mostri & Regole
- Scrivi nel campo di ricerca il nome del mostro (es. `goblin`, `drago`, `troll`).
- Clicca sul risultato → si apre la **scheda completa**: CA, PV, abilità,
  tratti, azioni, azioni leggendarie, resistenze/immunità.
- Sotto c'è la ricerca **incantesimi**: stessa cosa (es. `palla di fuoco`, `scudo`).

### ⚔️ Scontri & Iniziativa
**Genera lo scontro bilanciato:**
1. Inserisci il **numero di Personaggi Giocanti** (es. 4).
2. Inserisci il **livello dei PG** (es. 5).
3. Scegli la **difficoltà** (Facile / Medio / Difficile / Mortale).
4. La tabella mostra i 4 budget XP ufficiali (calcolati come da Guida del DM 5e).
5. Clicca **⚔️ Genera Incontro Bilanciato** → ottieni la lista dei mostri
   scelta in base al budget (es. "2 × Goblin + 1 × Bugbear").
6. Clicca **📋 Copia incontro** per portarlo nei tuoi appunti o in chat.

**Gestisci l'iniziativa (lato "preparazione"):**
- Aggiungi i combattenti con nome + tiro (clic **+ Aggiungi** o tasto Invio).
- Oppure **incolla qui sotto il testo della chat di Roll20** (seleziona le
  righe dei tiri in Roll20 → Ctrl+C → qui Ctrl+V) e clicca
  **📥 Estrai tiri dal testo**: l'app riconosce da sola i nomi e i totali
  (es. `Fia [d20+4] 23`, `Orco: 12`, `23 - Fia`, `Roll: Kael [1d20+3] = 17`).
- Clicca **▶ Avanza Turno** per passare al prossimo combattente (il suo nome
  resta illuminato in oro). Clicca un nome per saltare direttamente al suo turno;
  ✕ lo rimuove. **Pulisci** azzera tutto.
- La lista si **ricorda da sola**: puoi chiudere l'app e ritrovarla alla riapertura.

### 🎭 PNG & Eventi
**PNG coerente con la tua ambientazione:**
1. Scrivi 1-2 righe sulla tua ambientazione (es. *"Città portuale corrotta,
   toni dark fantasy, scarsa magia"*).
2. Clicca **✨ Genera PNG** → ottieni Nome, Razza, Età/Aspetto, Tratto
   caratteriale, Ideale, **Segreto** e **Aggancio alla trama** (più una frase iconica).
3. Se hai configurato una chiave LLM (vedi sezione 🔑 più sotto), spunta
   "Usa LLM" per una scheda scritta su misura dal modello linguistico.
   Senza chiave, il generatore procedurale interno fa comunque il lavoro (sempre disponibile).

**Meteo e imprevisti:**
1. Scegli il **bioma** (Foresta, Deserto, Montagne, Sotterranei, Mare, Pianura, Terra Gelida, Città).
2. Clicca **🎲 Genera Imprevisto** → meteo + un evento narrativo immediato
   compatibile col bioma, pronto da leggere ai tuoi giocatori.

### 💰 Bottino
1. Scegli la **fascia di CR** dell'incontro appena vinto (0-4, 5-10, 11-16, 17+).
   - *Trucco:* se hai appena generato un incontro, clicca **⚡ Usa CR ultimo
     incontro** e la fascia giusta viene impostata da sola.
2. Clicca **🎲 Genera Bottino** → monete (rame/argento/oro/platino) + oggetti
   magici del SRD (con rarità) + valore stimato in gp.
3. Clicca **📋 Copia bottino** e incollalo dove vuoi.

### ⚙️ Impostazioni
- **Chiave LLM** (facoltativa): vedi sezione 🔑 qui sotto.
- **Azzera dati locali**: cancella chiave, iniziativa e incontri salvati nel browser.

---

# 🅱️ OPZIONE B — Portare l'assistente dentro Roll20 (Tampermonkey)

> Con questa opzione, **durante la partita**, l'assistente vive in un pannello
> fluttuante sulla pagina di Roll20 e **legge la chat da solo**: quando un PG o
> un mostro tira l'iniziativa, viene aggiunto automaticamente alla lista.

## Passaggio 1 — Installa Tampermonkey (una tantum, ~2 minuti)
Tampermonkey è un'estensione **gratuita** del browser.

**Se usi Chrome o Edge:**
1. Apri il browser e vai su: **https://www.tampermonkey.net/**
2. Clicca il bottone blu **"Add to Chrome"** (o "Add to Edge").
3. Clicca **"Aggiungi estensione"** nella finestra di conferma.
4. (Opzionale) fissa l'icona: tasto destro sulla barra dei puntini ⋮ →
   "Pannello estensioni" → icona a crocetta 🔍 → clicca la spunta su Tampermonkey.

**Se usi Firefox:**
1. Vai su **https://www.tampermonkey.net/** (Firefox ti porterà al suo store).
2. Clicca **"Aggiungi a Firefox"** → **"Aggiungi"**.

Dovresti vedere una piccola icona a crocetta (/puzzle) nella barra del browser.

## Passaggio 2 — Installa lo script (una tantum, ~1 minuto)
1. Clicca l'icona **Tampermonkey** nella barra del browser.
2. Nel menu che si apre, clicca **"Crea un nuovo script"**
   (in inglese: *"Create a new user script"*).
   Si apre una pagina con del codice di esempio già scritto.
3. **Seleziona TUTTO** il codice che c'è (Ctrl+A) e **cancellalo** (canc).
4. Apri il file **`assistente_dm_roll20.user.js`** con un editor di testo
   (Blocco Note su Windows, TextEdit su Mac), **seleziona tutto** il suo
   contenuto (Ctrl+A), **coppialo** (Ctrl+C).
5. Torna nella pagina di Tampermonkey e **incollalo** (Ctrl+V).
6. Premi **Ctrl+S** (oppure clicca il bottone 💾 *Salva/Save* in alto a destra).

   ✅ Fatto: l'icona di Tampermonkey ora mostra il numero **1** (un script attivo).

## Passaggio 3 — Usa l'assistente in Roll20
1. Vai sulla tua stanza di gioco su **https://app.roll20.net** e entra come sempre.
2. Caricata la mappa, nell'angolo **in alto a destra** appare il pannello
   **⚔️ Assistente DM**.
3. È **trascinabile** (afferra la barra del titolo e spostalo dove vuoi) e si
   **minimizza** col bottone **—** (per riaprirlo: clic di nuovo sull'icona, o
   dal menu Tampermonkey → "Apri Assistente DM").

## 🎲 Come funziona l'iniziativa automatica
- In chat di Roll20, come fai di solito, scrivi il tiro con la parola
  "iniziativa", ad esempio:
  ```
  /roll [1d20 + 4] initiative
  ```
- L'assistente **capta il messaggio**, legge il nome e il totale, e lo aggiorna
  nella sua lista ordinata (con un lampeggio dorato).
- Clicca **▶ Avanza Turno** per passare al prossimo: il turno corrente resta
  illuminato, i precedenti si "spengono". Clicca un nome per saltare al suo
  turno, ✕ per rimuoverlo (es. un PG che non partecipa).
- **Aggiunta rapida:** sotto la lista c'è un menu a tendina con i nomi che
  hanno tirato un d20 in chat di recente — scegli il nome, inserisci il valore
  se non è stato colto, clic **+**.

## ⚖️ Scontri bilanciati e livelli PG (dal pannello Roll20)
- Scheda **Scontri**: PG + livello + difficoltà → **Genera Incontro**.
- Sezione **"Livelli PG"** in fondo alla scheda Scontri:
  - Scrivi il nome di un PG e il suo livello → **Salva** (si ricorda tra le partite).
  - **Liv. medio → Scontri**: mette automaticamente il livello medio del gruppo nel generatore.
  - **📣 Promemoria in chat**: invia in chat un promemoria tipo
    *"⚔️ Promemoria DM — Livello medio gruppo: 5 (Fia 5 · Kael 6)"* —
    utile se giochi da solo o con un co-DM.

## 🎭 PNG, 💰 Bottino, 🌩️ Eventi, ⚙️ Impostazioni
Stesse funzioni della App standalone, compresse nel pannello (schede in alto).

---

# 🔑 Chiave LLM (FACOLTATIVA — per PNG e imprevisti "intelligenti")

> **Nota bene:** la chiave è **opzionale al 100%**. Senza di essa l'app genera
> PNG, eventi, scontri e bottino con i suoi sistemi procedurali interni e funziona
> perfettamente. La chiave serve solo se vuoi che un modello linguistico scriva
> il PNG "a mano libera" usando la tua ambientazione come spunto.

Come funziona in modo sicuro:
- **Incolli la chiave** nel campo della scheda **Impostazioni** (App) o nella
  scheda **⚙️** (pannello Roll20).
- Viene salvata **solo nella memoria locale del TUO browser** (localStorage /
  memoria di Tampermonkey). Non è scritta nel codice, non passa da nessun
  server di alcun tipo, e viene inviata **solo** al provider che scegli tu,
  **solo** quando premi "Genera" con l'opzione LLM attiva.
- Puoi cancellarla in qualsiasi momento col bottone **🗑 Rimuovi chiave**.

## Dove si prendono chiavi GRATUITE

### Opzione 1 — OpenRouter (consigliata: ha modelli esplicitamente gratis)
1. Vai su **https://openrouter.ai** e crea un account (gratuito).
2. Menù in alto → **"Keys"** → **"Create Key"** → copia la chiave.
3. Nell'assistente: scheda Impostazioni → Provider **OpenRouter** → incolla la
   chiave.
4. **Scegli il modello dal menu a tendina**: l'app lo carica **da sola** da
   OpenRouter ed elenca i modelli **gratuiti disponibili in questo momento**
   (con il suffisso `:free`). Non serve ricordare nomi di modelli: scegli
   quello con ⚡ (il predefinito) o un altro dall'elenco.
5. **📡 Testa connessione** (deve dire "Connesso") → **💾 Salva**.
6. In PNG & Eventi spunta **"Usa LLM"** e genera.

> ⚠️ **L'elenco dei modelli gratis di OpenRouter ruota di mese in mese.**
> Se un giorno vedi l'errore *"This model is unavailable for free"*:
> 1. vai in Impostazioni,
> 2. clicca il bottone **🔄** accanto al menu dei modelli per ricaricare l'elenco,
> 3. scegli un modello diverso dalla lista,
> 4. **Salva** di nuovo.
> L'app ti mostra sempre l'elenco aggiornato, quindi il problema si risolve in 10 secondi.
> *(Al momento di questa guida, confermati attivi: `google/gemma-4-31b-it:free`,
> `qwen/qwen3.8-27b:free`, `z-ai/glm-5.2:free`.)*

### Opzione 2 — Groq (velocissimo, quota gratuita generosa)
1. Vai su **https://console.groq.com** e crea un account (gratuito).
2. **"API Keys"** → **"Create API Key"** → copia.
3. Nell'assistente: Provider **Groq** → incolla → **Testa** → **Salva**.
   Modello suggerito: `llama-3.3-70b-versatile`.

### Opzione 3 — Hugging Face
1. Vai su **https://huggingface.co** → crea account.
2. **Impostazioni account → Access Tokens → New token**.
3. Nell'assistente: Provider **Hugging Face** → incolla → **Testa** → **Salva**.
   Modello suggerito: `mistralai/Mistral-7B-Instruct-v0.2`.
   (Se il modello di default non risponde, prova a cambiarne il nome: cerca
   nella scheda Impostazioni un modello che supporti "chat".)

Se la connessione fallisce, l'app **non si rompe**: ti avvisa e usa comunque il
sistema procedurale (il PNG/imprevisto te lo dà lo stesso).

---

# 🛠️ Se qualcosa non va (problemi comuni)

| Problema | Soluzione |
|---|---|
| La pillola dice **🔴 Offline** | Non c'è internet, oppure l'API pubblica è giù in questo momento. L'app funziona lo stesso col dizionario locale: puoi continuare a usare tutto. Riaprila quando sei online. |
| Errore LLM **"This model is unavailable for free"** | Il modello scelto non è più nell'elenco gratuito di OpenRouter (ruota di mese in mese). Vai in Impostazioni → **🔄** accanto al menu dei modelli → scegli un altro modello dall'elenco → **Salva**. |
| Il pannello **non appare in Roll20** | 1) Ricarica la pagina (F5). 2) Clicca l'icona Tampermonkey e verifica che lo script "Assistente DM" abbia la **spunta attiva** (interruttore verde). 3) Verifica di essere su **app.roll20.net** (l'altro dominio non è coperto). |
| L'iniziativa **non viene captata** | La regola: il tiro deve contenere la parola **"iniziativa"** o **"initiative"** (es. `/roll [1d20+4] initiative`). Se usi un'altra parola, aggiungi il combattente a mano (nome + tiro → **+ Aggiungi**). |
| **Copiare** il testo non funziona | Alcune versioni di browser bloccano la copia in `file://`: seleziona manualmente il testo nel riquadro e fai Ctrl+C. Oppure usa l'app nel browser dopo averla caricata su un'URL http. |
| Voglio **riaprire il pannello** chiuso in Roll20 | Menu Tampermonkey → **"Apri Assistente DM"** (oppure ricarica la pagina). |
| L'app mi chiede il permesso di fare qualcosa | Puoi sempre negare: le uniche richieste sono la **rete** (per le API) e la **memoria locale** (per ricordarsi le tue scelte). |
| **Cancello tutto** e ricomincio? | Scheda Impostazioni → **⚠️ Azzera tutti i dati locali**. (In Roll20: la memoria di Tampermonkey si cancella dal suo pannello, sezione "Valori".) |

---

# ⚖️ Note su dati e copyright (importante)

- Tutti i dati di mostri e incantesimi provengono dal **System Reference
  Document 5.1** di Dungeons & Dragons, pubblicato da Wizards of the Coast con
  licenza **OGL 1.0a** — ovvero contenuti **aperti**, privi di copyright
  restrittivo. L'app li recupera da API pubbliche gratuite
  (5e-srdapi.com / dnd5eapi.co) oppure dal dizionario incorporato.
- Le **soglie di XP per scontro** usano il *metodo* della Guida del Dungeon
  Master 5e (tabella XP per livello × numero di PG × moltiplicatore di
  difficoltà), non testo copiato.
- Gli **oggetti magici** del bottino sono item del SRD (OGL 1.0a).
- L'app non contiene, non memorizza e non trasmette alcun materiale
  protetto da copyright.

---

**Buona campagna, Dungeon Master. 🎲**
