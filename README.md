# TimeCalc

TimeCalc is a small Express and SQLite app for tracking time ranges and recent entries.

## Stack

- Backend: Node.js with Express
- Frontend: plain HTML, CSS, and browser JavaScript
- Database: SQLite via `better-sqlite3`
- Deployment: Docker and Kubernetes manifests are included

## Project Layout

- `app/server/index.js`: Express server and API routes
- `app/server/time.js`: time calculation helpers
- `app/server/db.js`: SQLite database path resolution and schema bootstrap
- `app/public/index.html`: main UI
- `app/public/app.js`: frontend behavior and API calls
- `k8s/timecalc/`: Kubernetes manifests

## Running Locally

From the server directory:

```bash
cd ~/timecalc/app/server
npm install
node index.js
```

Then open `http://localhost:3000`.

## Database Behavior

TimeCalc chooses its SQLite database path in this order:

1. `TIMECALC_DB_PATH`, if set
2. `/data/timecalc.sqlite`, if `/data` exists
3. `app/server/timecalc.sqlite` for local development

On startup, TimeCalc will:

- create the parent folder if needed
- create a new empty SQLite database file if one does not exist
- create the `entries` table automatically if needed

This gives a simple cross-environment workflow:

- Local macOS development uses `app/server/timecalc.sqlite`
- Docker or Kubernetes can use `/data/timecalc.sqlite`
- Other environments can set `TIMECALC_DB_PATH` explicitly

## Kubernetes Storage

In Kubernetes, the app mounts `/data` from the persistent volume claim `timecalc-pvc`.

- `k8s/timecalc/deployment.yaml` mounts the volume at `/data`
- `k8s/timecalc/storage-request.yaml` defines the PVC

That means redeploying the app updates code without requiring the SQLite file to be stored in Git.
