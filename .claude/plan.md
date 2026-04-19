# Construction Expense Tracker — Implementation Plan

## 1. Architecture

```
[React SPA]  ←──→  [Node.js API Server]  ←──→  [Turso SQLite]
  (Vite)              (Express)                  [Filen Storage]
  GitHub Pages        Railway/Render             [Whisper API]
                                                 [OpenRouter LLM]
```

```
Frontend (React + Vite)          Backend (Node.js + Express)
───────────────────────          ──────────────────────────
GET  /api/expenses          →    db.getAllExpenses()
GET  /api/advances          →    db.getAllAdvances()
GET  /api/categories        →    db.getAllCategories()
POST /api/categories        →    db.addCategory() / updateCategory() / setCategoryActive()
POST /api/advances          →    db.addAdvance()
POST /api/transcribe        →    whisperService.transcribe(audio)
POST /api/parse             →    llmService.parseNotes(text, categories)
POST /api/commit            →    filenService.upload(images) + db.addExpense(rows)
POST /api/upload-image      →    filenService.upload(image) → { cloudPath }
GET  /api/files?path=...    →    filenService.readFile(path) → proxy stream
```

Two deployments: static SPA on GitHub Pages, Node.js server on a free-tier PaaS.

## 2. Tech Stack

- **Frontend:** React SPA (Vite + TypeScript) → GitHub Pages
- **Backend:** Node.js + Express + TypeScript
- **Database:** Turso (hosted SQLite) via `@libsql/client`
- **File storage:** Filen (`@filen/sdk`) — free 10GB, E2E encrypted, date-wise folders
- **LLM:** OpenRouter (for structuring messy input into expense rows)
- **Speech-to-text:** Whisper (OpenAI API via `openai` SDK)
- **Auth:** shared-secret header (`X-Auth-Token`) on all endpoints
- **Hosting (backend):** Railway free tier / Render free tier / any VPS

## 3. Data Schema

### Sheet tab: `expenses`

| Column | Type | Notes |
|---|---|---|
| `id` | string | UUID, generated server-side |
| `date` | date | YYYY-MM-DD, extracted by LLM or fallback to today |
| `category` | string | must match a value from `categories` tab |
| `description` | string | free text — user note + LLM summary |
| `quantity` | number | optional |
| `unit` | string | kg, bags, pieces, sq ft, etc. |
| `rate` | number | optional (per-unit price) |
| `total` | number | the amount spent |
| `image_urls` | string | comma-separated Filen public URLs (same URL can appear in multiple rows) |
| `created_at` | datetime | ISO timestamp of when the row was committed |

### Sheet tab: `advances`

Tracks money given to Saleem Sahab (construction supervisor). He handles all payments on-site.

**Saleem's net balance = Sum(advances.amount) − Sum(expenses.total)**

| Column | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `date` | date | YYYY-MM-DD |
| `amount` | number | money given to Saleem |
| `note` | string | optional context |

### Sheet tab: `categories`

Bilingual enum list. Format: `اردو (english)` — e.g. `بجری (gravel)`.

| Column | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `label` | string | display label, e.g. `اینٹ (bricks)` |
| `active` | boolean | `TRUE` / `FALSE` — soft-delete |

## 4. Backend (Node.js + Express)

### Project structure

```
server/
├── src/
│   ├── index.ts              # Express app setup, CORS, auth middleware
│   ├── middleware/
│   │   └── auth.ts           # X-Auth-Token check
│   ├── routes/
│   │   ├── expenses.ts       # GET /api/expenses
│   │   ├── advances.ts       # GET + POST /api/advances
│   │   ├── categories.ts     # GET + POST /api/categories
│   │   ├── transcribe.ts     # POST /api/transcribe
│   │   ├── parse.ts          # POST /api/parse
│   │   ├── commit.ts         # POST /api/commit
│   │   └── upload.ts         # POST /api/upload-image
│   ├── services/
│   │   ├── sheets.ts         # Google Sheets read/write via googleapis
│   │   ├── filen.ts          # Filen SDK — upload, create folders, get public links
│   │   ├── whisper.ts        # OpenAI Whisper transcription
│   │   └── llm.ts            # OpenRouter LLM calls
│   └── config.ts             # env vars, secrets
├── package.json
└── tsconfig.json
```

### Endpoints

---

**`GET /api/expenses`**
- `sheetsService.getAll('expenses')` → return JSON array

**`GET /api/advances`**
- `sheetsService.getAll('advances')` → return JSON array

**`GET /api/categories`**
- `sheetsService.getAll('categories')` → filter `active === TRUE` → return JSON array

---

**`POST /api/categories`**
- Body: `{ action: "add" | "update" | "delete", id?, label? }`
- `add` → append row (new UUID, label, active=TRUE)
- `update` → find by id, update label
- `delete` → find by id, set active=FALSE
- Return updated list

**`POST /api/advances`**
- Body: `{ date, amount, note? }`
- Generate UUID, append to `advances` tab
- Return `{ success: true, id }`

---

**`POST /api/transcribe`**
- Accept: multipart with audio blob (webm/mp3)
- `whisperService.transcribe(audioBuffer)` → text
- Return `{ text: "..." }`
- **Transcription only.** Text goes back to the frontend text box for user to verify/edit.

---

**`POST /api/parse`**
- Body: `{ text: "...", categories: [...] }`
- Text is user-verified content (typed notes or corrected transcription)
- `llmService.parseExpenses(text, categories)` with structured-output prompt:
  - "You are a construction expense parser. Given messy notes about construction purchases, extract a JSON array of expense rows. Each row: {date, category, description, quantity, unit, rate, total}. Use ONLY these categories: [list]. If date unclear, null. If rate/quantity unclear, just fill total."
- Return `{ rows: [...] }`
- **Text-only, no file handling.**

---

**`POST /api/commit`**
- Accept: multipart — JSON body + image files
- Body: `{ rows: [...], assignments: { "0": [0, 2], "1": [1] } }` (row index → image indices)
- For each image:
  - `filenService.upload(file, 'Construction/YYYY-MM-DD/')` → public URL
- For each row:
  - Generate UUID
  - Map assigned image indices → comma-separated Filen URLs
  - `sheetsService.appendRow('expenses', rowData)`
- Return `{ success: true, ids: [...] }`

---

**`POST /api/upload-image`**
- Accept: multipart with single image
- `filenService.upload(file, 'Construction/YYYY-MM-DD/')` → public URL
- Return `{ url: "https://..." }`

### Services

**`sheets.ts`** — wraps `googleapis` Sheets v4:
- `getAll(tab)` — read all rows, return as JSON objects
- `appendRow(tab, data)` — append a single row
- `updateCell(tab, rowIndex, col, value)` — for category updates
- Uses service account credentials

**`filen.ts`** — wraps `@filen/sdk`:
- `init()` — authenticate with Filen credentials
- `ensureFolder(path)` — create date folder if it doesn't exist
- `upload(buffer, filename, folderPath)` — upload file, return public share link
- `getPublicUrl(fileId)` — generate/get public link for a file

**`whisper.ts`** — wraps `openai` SDK:
- `transcribe(audioBuffer, mimetype)` — send to Whisper, return text string

**`llm.ts`** — wraps OpenRouter HTTP API:
- `parseExpenses(text, categories)` — send structured prompt, return parsed JSON rows

## 5. Frontend (React SPA, Vite)

React + Vite + TypeScript, deployed as static build to GitHub Pages. Bilingual support (Urdu labels where needed).

### Page 1: Dashboard (`/`)

**Summary cards:**
- Total Spent (all time)
- Saleem Balance (given − spent) — green if positive, red if negative
- This Month's spend
- Entry count

**Category-wise breakdown:**
- Table or card grid showing each category with its subtotal
- e.g. `اینٹ (bricks): Rs 45,000`

**Charts (Recharts):**
- Pie: spend by category
- Line: spend over time (weekly buckets)

**Filters:** date range picker

### Page 2: Entries (`/entries`)

- Full table of all expense rows
- Sortable by date, category, total
- Filterable by: date range, category dropdown
- **Group-by-date toggle:** collapse rows under date headers
- **Expandable rows:** click a row → slides open to show image thumbnails
- Search box for description text

### Page 3: Saleem Ledger (`/saleem`)

- Table of all advances: date, amount, note
- **Add advance form** at the top: date + amount + optional note → POST /api/advances
- Summary bar: **Total Given** | **Total Spent** | **Net Balance**

### Page 4: Add Entry (`/add`)

**Step 1 — Input (text area is the central element):**
- Large text area for notes (always visible)
- Record button next to it — records audio via MediaRecorder → POST /api/transcribe → **returned text populates the text area** → user edits/verifies
- File upload area below (drag-drop, multi-file) for bill images

**Step 2 — Process:**
- "Process" button sends text area content to POST /api/parse
- Spinner → LLM returns structured rows

**Step 3 — Preview & Assign:**
- Editable table of extracted rows (date, category dropdown, description, qty, unit, rate, total)
- Image thumbnails panel on the side
- **Image assignment:** click an image → click rows to assign (row highlights, image badge shows assigned rows). One image → multiple rows OK.
- User can add/remove/edit rows

**Step 4 — Confirm:**
- "Confirm & Save" → POST /api/commit with rows + images + assignments → success toast → clear

### Page 5: Manage Categories (`/categories`)

- List of current categories with Urdu (English) labels
- Add new: text input → POST /api/categories with action=add
- Edit: inline edit → POST with action=update
- Delete: soft-delete button → POST with action=delete (grays out)

### Page 6: Quick Image Upload (`/upload`)

Minimal page:
- File picker (single or multi)
- Upload → spinner → returns URL(s)
- Each URL has a "copy to clipboard" button
- Shows recent uploads for the day

## 6. File Storage (Filen)

Filen free tier: 10GB, E2E encrypted. Using `@filen/sdk` for all file operations.

### Folder structure:

```
Construction/
├── 2026-04-18/
│   ├── receipt_001.jpg
│   ├── receipt_002.jpg
│   └── bill_003.png
├── 2026-04-19/
│   └── cement_bill.jpg
└── ...
```

- Server creates date folder on first upload of the day
- Each uploaded file gets a public share link generated via Filen SDK
- Share links are stored in the `image_urls` column of the expenses sheet

## 7. Security

- All endpoints check `X-Auth-Token` header against `AUTH_SECRET` env var
- Frontend stores token in `localStorage` after a simple password prompt on first visit
- Google Sheet stays private; only the service account has access
- Filen files are shared via individual public links (not folder-level)
- CORS: backend allows only the GitHub Pages origin
- If real auth needed later: Cloudflare Access in front of GitHub Pages

## 8. Environment Variables (server)

```
AUTH_SECRET=<shared secret for X-Auth-Token>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service account email>
GOOGLE_PRIVATE_KEY=<service account private key>
GOOGLE_SHEET_ID=<spreadsheet ID>
FILEN_EMAIL=<filen account email>
FILEN_PASSWORD=<filen account password>
OPENAI_API_KEY=<for Whisper>
OPENROUTER_API_KEY=<for LLM>
```

## 9. Build Order

Phase 1 — Foundation:
1. Scaffold: `server/` (Express + TS) and `client/` (Vite + React + TS) in monorepo
2. Google Sheet: create spreadsheet with `expenses`, `advances`, `categories` tabs
3. Backend: auth middleware + sheets service + GET endpoints + POST /categories + POST /advances
4. Frontend: Dashboard + Entries + Saleem Ledger + Categories pages
5. Deploy: backend to Railway/Render, frontend to GitHub Pages

Phase 2 — Smart Input:
6. Backend: whisper service + POST /api/transcribe
7. Backend: llm service + POST /api/parse
8. Backend: filen service + POST /api/commit
9. Frontend: Add Entry page (audio recorder, text area, preview, image assignment)

Phase 3 — Utilities:
10. Backend: POST /api/upload-image
11. Frontend: Quick Image Upload page
