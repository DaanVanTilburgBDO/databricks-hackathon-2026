# Data Readiness Desk — Devpost Submission

> **Track 4 · Data Quality** — *What needs to be fixed before this dataset can be trusted for planning?*

---

## Inspiration

Healthcare planning decisions — where to send patients, which facilities can handle emergencies, where care gaps exist — only hold up if the underlying data can be trusted. When we looked at the 10,000 Indian healthcare facility records provided for this hackathon, we found a dataset full of potential but riddled with risk: missing doctor counts, capacities listed as zero, descriptions copy-pasted verbatim across dozens of facilities, and equipment claims that read more like marketing than medical inventory.

Before any of the other tracks can answer their questions with confidence, someone has to ask: *is this data actually ready?* That question — and the human workflow required to answer it — is what Data Readiness Desk is built around.

---

## What it does

Data Readiness Desk is a Databricks App that helps a non-technical data steward, NGO analyst, or healthcare planner **profile, prioritise, and review** the facility dataset so it can be trusted for downstream decisions.

The app has four main views:

### 1. Dashboard
A one-page picture of dataset readiness. At a glance, reviewers see:
- **Quality summary cards** — total facilities broken into high-priority (≥5 missing fields), medium-priority (3–4 missing), and clean (0–2 missing).
- **Field coverage bars** — worst-to-best completeness across `capacity`, `numberDoctors`, `yearEstablished`, `equipment`, `procedure`, `capability`, and `description`, colour-coded red/amber/green.
- **Coverage by state table** — record counts alongside description and capability fill rates for every Indian state in the dataset, making regional data poverty immediately visible.

### 2. Review Queue
The 100 highest-priority records — those with the most missing fields — queued for human triage. Reviewers can filter by state, search by facility name, and filter by review status (pending / approved / flagged / rejected). Each card previews the facility's location, type, missing-field badges, and a description snippet so a reviewer can decide whether to open the record without reading every field.

### 3. Record Detail & AI Review
The full record view. On the left: all facility fields, evidence sections (capabilities, procedures, equipment, specialties rendered as tag clouds), and a **data quality issues panel** that flags specific missing fields. At the centre sits the **AI Record Review panel**, which calls a Databricks Model Serving LLM to analyse the record and return structured findings:
- **Contradictions** — field combinations that logically conflict (e.g., "500-bed capacity listed but only 1 doctor").
- **Suspicious claims** — implausible or likely-copied values.
- **Sparse or vague fields** — fields that are present but too generic to be actionable.
- **High-leverage flag** — whether the facility is worth prioritising for human enrichment (large urban hospital, many specialist capabilities, etc.).
- **Overall assessment** — a one-to-two sentence plain-English summary of data readiness.

AI results are cached in Lakebase (Databricks-managed Postgres) so repeated views of the same record return instantly.

On the right: the sticky **Reviewer Panel**, where a human can set a status (pending / approved / flagged / rejected), toggle a shortlist flag to keep high-value records visible for downstream enrichment, write free-text notes, and save the decision — all persisted to Lakebase.

### 4. AI/BI Genie
An embedded Databricks AI/BI Genie room lets any non-technical user ask natural-language questions about the dataset — "Which states have the lowest capability coverage?", "How many facilities have no doctor count and no capacity?" — without writing SQL.

---

## How we built it

The app is built on **Databricks AppKit**, which wires together three Databricks-native services without any infrastructure configuration:

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Radix UI / shadcn-ui |
| Backend | Node.js, Express (AppKit Server plugin) |
| Analytics queries | Databricks SQL Warehouse via AppKit Analytics plugin |
| Reviewer decisions storage | Databricks Lakebase (managed Postgres) via AppKit Lakebase plugin |
| AI record analysis | Databricks Model Serving LLM via AppKit Serving plugin |
| Natural-language exploration | Databricks AI/BI Genie (embedded iframe) |
| Deployment | Databricks Apps (`databricks.yml` bundle) |

The SQL queries (`quality_summary`, `field_completeness`, `state_distribution`, `review_queue`, `facility_detail`) run directly against Unity Catalog via the Analytics plugin, with parameterised queries to prevent injection. The LLM prompt is carefully structured to return a strict JSON schema — contradictions, suspicious claims, sparse fields, high-leverage flag — with Zod validation on the server to handle any model non-compliance gracefully.

Reviewer decisions and AI analysis results are stored in two Postgres tables (`review.decisions`, `review.ai_reviews`) owned by the app's Service Principal, with `ON CONFLICT` upsert semantics so the same record can be revisited and updated.

---

## Challenges we ran into

**Messy data is genuinely messy.** Fields like `capability`, `procedure`, and `equipment` arrive as JSON arrays, free-text strings, newline-delimited lists, and sometimes all three in the same column. We built a shared parsing layer that tries JSON first, then falls back to delimiter splitting, deduplicates, and trims — but edge cases kept appearing throughout the build.

**LLM output reliability.** Even with a strict system prompt and `temperature: 0`, the model occasionally wraps JSON in markdown code fences or adds a preamble sentence. We added a regex extraction step (`/\{[\s\S]*\}/`) before JSON parsing, with Zod `.catch()` defaults on every field so a malformed response degrades gracefully rather than crashing the UI.

**Lakebase schema ownership.** The Lakebase Postgres schema must be created by the Service Principal that owns it. Running the app locally before deploying meant the schema got created under a developer's credentials and the deployed app was then denied access. We documented this prominently in the README and the deploy-first workflow.

**AppKit Serving plugin response shape.** The Serving plugin wraps model responses in a discriminated union `{ ok: true, data }` / `{ ok: false, message }` at runtime, while also sometimes returning the raw response object directly during local development. We added type-narrowing to handle both shapes without breaking either environment.

---

## Accomplishments that we're proud of

- **End-to-end human review workflow in a single Databricks App** — from profiling the whole dataset down to capturing a final reviewer decision on a single record, with AI assistance at the point of decision.
- **AI analysis that degrades gracefully** — the LLM is advisory, not blocking. If the model is unreachable or returns garbage, the rest of the record detail page still works and the reviewer can still save a decision.
- **State-level coverage gaps are immediately visible** — the dashboard makes it obvious which Indian states are data deserts before any individual record is opened.
- **Lakebase as a durable decision store** — review decisions and AI results survive app restarts and are shared across all users of the deployed app in real time.

---

## What we learned

- Databricks AppKit makes it genuinely fast to wire together SQL Warehouses, Lakebase, and Model Serving in a single full-stack app — the plugin system removes almost all of the infrastructure boilerplate.
- AI/BI Genie is a powerful escape hatch for ad-hoc questions that don't fit a pre-built dashboard.
- Data quality work is inherently human-in-the-loop. The AI can surface contradictions and suspicious values at scale, but the final judgement — *is this facility worth trusting?* — still needs a person.

---

## What's next for Data Readiness Desk

- **Bulk review actions** — approve or flag multiple records in the queue without opening each one individually.
- **Enrichment suggestions** — after flagging a record, the AI proposes specific web searches or source URLs a data steward could check to fill the gap.
- **Export** — download the reviewed shortlist as a CSV for use in the Medical Desert Planner or Referral Copilot tracks.
- **Contradiction cross-referencing** — detect records where the same facility appears under two different names or postcodes, flagging potential duplicates at scale.

---

## Built with

`appkit` · `react` · `tailwind` · `typescript` · `express` · `databricks-sql` · `lakebase` · `databricks-model-serving` · `ai-bi-genie` · `radix-ui` · `shadcn-ui` · `vite` · `zod`

---

## Try it out

- **Live app:** https://data-readiness-desk-7474645355849929.aws.databricksapps.com
- **Source code:** https://github.com/DaanVanTilburgBDO/databricks-hackathon-2026
