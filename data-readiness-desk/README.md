# Data Readiness Desk

A Databricks App powered by [AppKit](https://www.databricks.com/devhub/docs/appkit/v0/), featuring React, TypeScript, and Tailwind CSS.

Data quality profiling and reviewer decision tool for the Indian healthcare facility dataset.

**Enabled plugins:**
- **Analytics** — SQL query execution against Databricks SQL Warehouses
- **Lakebase** — Fully managed Postgres database for persisting reviewer decisions
- **Server** — Express HTTP server with static file serving and Vite dev mode

## Prerequisites

- Node.js v22+ and npm
- [Databricks CLI](https://docs.databricks.com/dev-tools/cli/install.html) v1.0.0+
- An authenticated Databricks CLI profile (`databricks auth profiles` shows `Valid: YES`)

## ⚠️ Deploy Before Running Locally

This app uses Lakebase. The app's Service Principal must create and own the `review` schema. **Always deploy first** — if you run locally before deploying, the schema gets created under your credentials and the deployed app will fail with `permission denied for schema review`.

1. Deploy first (see [Deploy to Databricks](#deploy-to-databricks) below)
2. Then run locally

## Run Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your workspace values. The profile-based auth approach (recommended):

```env
DATABRICKS_CONFIG_PROFILE=<your-profile-name>
DATABRICKS_WAREHOUSE_ID=<your-sql-warehouse-id>
PGDATABASE=databricks_postgres
LAKEBASE_ENDPOINT=projects/<project-id>/branches/production/endpoints/primary
PGHOST=<endpoint-host>
PGPORT=5432
PGSSLMODE=require
DATABRICKS_APP_PORT=8000
DATABRICKS_APP_NAME=data-readiness-desk
```

> **Getting Lakebase values:** Run `databricks postgres get-endpoint projects/<project-id>/branches/production/endpoints/primary --profile <your-profile>` to retrieve `PGHOST` and `LAKEBASE_ENDPOINT`. The project, branch, and database names are defined in `databricks.yml`.

> **Profile auth:** `DATABRICKS_CONFIG_PROFILE` must match a profile in `~/.databrickscfg` with `Valid: YES` (check with `databricks auth profiles`). The profile is used for both SQL warehouse queries and Lakebase token refresh.

### 3. Start the development server

```bash
npm run dev
```

The app will be available at **http://localhost:8000** with hot reload enabled for both client and server.

---

## Deploy to Databricks

### 1. Ensure your CLI profile is authenticated

```bash
databricks auth profiles
# Look for your profile with Valid: YES
```

If not authenticated:

```bash
databricks auth login --host https://your-workspace.cloud.databricks.com --profile <profile-name>
```

### 2. Deploy

```bash
databricks apps deploy --auto-approve --profile <your-profile>
```

This command runs the full pipeline: typegen → lint → typecheck → build → upload → deploy. The deployed app URL is printed on completion and is also visible in your Databricks workspace under **Apps**.

> **First deploy:** The Service Principal is provisioned on first deploy. After deploying, grant it access to the Unity Catalog dataset:
> ```sql
> GRANT USE CATALOG ON CATALOG <catalog-name> TO `<sp-client-id>`;
> GRANT USE SCHEMA ON SCHEMA <catalog>.<schema> TO `<sp-client-id>`;
> GRANT SELECT ON TABLE <catalog>.<schema>.<table> TO `<sp-client-id>`;
> ```
> Find the SP client ID with `databricks apps get <app-name> --profile <profile>`.

### Deploy with a specific profile

```bash
databricks apps deploy --auto-approve --profile <profile-name>
```

> **Multiple workspaces:** Add profiles to `~/.databrickscfg` and pass `--profile <name>` to any `databricks` command. Per-target workspace hosts can also be defined in `databricks.yml`.

---

## Code Quality

```bash
# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:fix
```

## Project Structure

```
* client/          # React frontend
  * src/           # Source code
  * public/        # Static assets
* server/          # Express backend
  * server.ts      # Server entry point
  * routes/        # Routes
* shared/          # Shared types
* config/          # Configuration
  * queries/       # SQL query files
* databricks.yml   # Bundle configuration
* app.yaml         # App configuration
* .env.example     # Environment variables example
```

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: React.js, TypeScript, Vite, Tailwind CSS, React Router
- **UI Components**: Radix UI, shadcn/ui
- **Databricks**: AppKit SDK
