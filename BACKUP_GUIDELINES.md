# Backup Guidelines: UniTracker

**Versione Documento**: 1.0  
**Data**: 12 Dicembre 2025  
**Stato**: Produzione (Deployed su Vercel)

---

## 1. Panoramica del Progetto
**UniTracker** è una dashboard personale per monitorare la carriera universitaria (Esami, Media, Proiezioni) e le spese/scadenze. È costruita per essere "Single User" (senza auth complessa) ma persistente.

### Tech Stack
*   **Framework**: Next.js 16 (App Router)
*   **Styling**: Tailwind CSS v4 (utilizzando `lucide-react` per le icone)
*   **Database**: Supabase (PostgreSQL) con `supabase-js`
*   **Hosting**: Vercel

---

## 2. Architettura e Componenti Chiave

### `app/page.tsx` (Il Monolite)
Attualmente funge da "Controller" principale.
*   **Responsabilità**:
    *   Fetch iniziale dati (Exams + Deadlines).
    *   Calcolo Statistiche (Media Ponderata, Proiezione Voto Laurea).
    *   Logica "Simulation Mode" (stato locale effimero per simulare voti).
    *   Orchestrazione dei Modal (AddExam, AddDeadline).
*   **Nota**: Contiene la definizione di `priorityEvent` (o meglio, `nextExamData` e `nextDeadlineData`) per i widget di countdown.

### `components/CountdownHero.tsx`
Il componente visivo principale.
*   **Logica Colori**: Non si basa sul *tipo* di evento, ma sull'**urgenza** (giorni mancanti).
    *   <= 7gg: `Rose-600` (Urgentissimo)
    *   <= 15gg: `Orange-500` (Attenzione)
    *   <= 30gg: `Indigo-600` (In arrivo)
    *   > 30gg: `Emerald-600` (Tranquillo)
*   **Tipografia**: Testi forzati in `text-white` o `white/90` per leggibilità ad alto contrasto.

### Forms (`AddExamForm`, `AddDeadlineForm`)
Gestiscono Creazione, Modifica ed Eliminazione.
*   **Gestione Errori**: Hanno blocchi `try/catch` robusti per evitare che il bottone "Salva" rimanga bloccato su "Salvataggio...".
*   **Tipi**: Fai attenzione che i campi (es. `category` nelle scadenze) corrispondano a quanto definito in `types/index.ts`.

### `types/index.ts`
Il contratto di verità.
*   **Importante**: Se modifichi il DB su Supabase, **DEVI** aggiornare queste interfacce, altrimenti la build di Vercel fallisce (come successo in passato con `Deadline`).

---

## 3. Schema Database (Supabase)

### Tabella: `exams`
| Colonna | Tipo | Note |
| :--- | :--- | :--- |
| `id` | uuid | Primary Key |
| `name` | text | Nome esame |
| `cfu` | int2 | Crediti |
| `grade` | int2 | Voto (Null se pianificato) |
| `date` | date | Data appello |
| `status` | text | `'passed'`, `'planned'`, `'failed'` |
| `location` | text | Luogo fisico |
| `is_paid_location` | bool | Se richiede trasferta pagata |

### Tabella: `deadlines`
| Colonna | Tipo | Note |
| :--- | :--- | :--- |
| `id` | uuid | Primary Key |
| `title` | text | Descrizione |
| `due_date` | date | Scadenza |
| `amount` | numeric | Importo € |
| `category` | text | `'tax'`, `'material'`, `'project'`, `'other'` |
| `is_completed` | bool | Stato pagamento |

---

## 4. Configurazioni "Speciali" (Da Sapere)

1.  **Icona Applicazione**:
    *   Il file si trova in `app/icon.jpg`. Next.js genera automaticamente le meta-tags. Non usare `public/icon.jpg` o link manuali in layout.

2.  **Accesso Rete Locale (Smartphone)**:
    *   Nel `package.json`, lo script `dev` è modificato in:
        ```json
        "dev": "next dev -- -H 0.0.0.0"
        ```
    *   Questo permette di accedere all'app digitando l'IP del computer (es. `192.168.1.X:3000`) dal telefono sotto lo stesso Wi-Fi.

3.  **Simulatore Voti**:
    *   La modalità "Simulatore" è **client-side only**. I voti inseriti lì NON vengono salvati nel database. Se ricarichi la pagina, spariscono. È "by design".

---

## 5. Procedura di Ripresa Lavori

Se torni su questo progetto tra 6 mesi:

1.  **Setup**:
    ```bash
    git pull origin main
    npm install
    ```
2.  **Verifica Env**:
    Assicurati che `.env.local` esista e contenga:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    ```
3.  **Avvio**:
    ```bash
    npm run dev
    ```
    *(Browser: `http://localhost:3000`)*

4.  **Deploy**:
    Basta fare un push su `main`. Vercel è collegato e farà il deploy automatico.
    ```bash
    git push
    ```

---

## 6. Punti di Attenzione per il Futuro (To-Do / Refactoring)

*   **Refactoring `page.tsx`**: Il file sta diventando grande (~600 righe). Considerare di estrarre la logica di calcolo stats in un Custom Hook (`useExamStats`).
*   **Costo Sedi**: Attualmente `isPaidLocation` è solo un flag visivo. In futuro si potrebbe aggiungere un calcolo dei costi stimati per le trasferte.
*   **Login**: Se mai volessi renderlo multi-utente, dovrai abilitare RLS su Supabase e implementare Supabase Auth. Attualmente è tutto "pubblico" (lato client key).
