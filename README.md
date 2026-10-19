# Trade Processing & Risk Platform

A simplified version of what happens to a US equity trade after a trader books it. The trade is
checked against the trader's account entitlements and the account's risk limits, then accepted
or rejected with a reason, and settled one business day later (T+1). Every step is recorded, so
you can always see what happened to a trade, who did it and why.

This is a student portfolio project that simulates post-trade processing. It isn't a trading app
(there's no market data or order matching) and it isn't connected to a real clearing or settlement
system: settling a trade here only updates its status in the database. What I wanted to model is
the checks that happen between booking a trade and settling it. A trade on the wrong account, a
mistyped price or an account going over its daily limit should be caught before it settles, and
when something does go wrong, there should be a record of what happened to each trade and who
changed which limit.

![Trades page: accepted, settled, rejected and cancelled trades, with rejection reasons](docs/screenshots/trades.png)

## Features

- **Trade lifecycle**: `RECEIVED → VALIDATED → ACCEPTED → SETTLED`, or `REJECTED` / `CANCELLED`
  with a reason. Each trade has a timeline of every status change.
- **Risk controls**: per-account limits on price (vs. a reference price), notional per trade and
  notional per day. Risk managers can change them, with a required reason.
- **Account entitlements**: traders can only book trades on the accounts they're assigned to.
- **Duplicate protection**: resubmitting the same trade (after a timeout, say) returns the original
  instead of booking it twice.
- **Audit trail**: every risk limit change records the old value, the new value, who changed it and why.
- **Settlement**: a scheduled job settles accepted trades on their settlement date. Operations can
  also run it by hand.
- **Role-based access**: traders, operations and risk managers each get their own pages and
  actions, enforced by the backend.

| New trade (trader) | Accepted, waiting for T+1 | Rejected: over daily limit |
|---|---|---|
| ![New trade form](docs/screenshots/new-trade.png) | ![Accepted trade and its lifecycle](docs/screenshots/trade-accepted.png) | ![Trade rejected for going over the daily limit](docs/screenshots/trade-detail.png) |
| **Settlement (operations)** | **Risk limits (risk manager)** | **Audit log** |
| ![Settlement page](docs/screenshots/settlement.png) | ![Risk limits page](docs/screenshots/risk-limits.png) | ![Audit log of risk limit changes](docs/screenshots/audit-log.png) |

## Tech stack

- **Backend**: Java 21, Spring Boot 4 (Web MVC, Data JPA, Security), PostgreSQL 17, Flyway
- **Frontend**: React 19, TypeScript, Vite, served by nginx in the Docker image
- **Tests**: JUnit 5 with Testcontainers, Vitest
- **Running it**: Docker Compose, Kubernetes on a local kind cluster, GitHub Actions for CI

## Running locally

### With Docker (easiest)

Needs Docker Desktop. This builds and starts the database, backend and frontend:

```powershell
docker compose up --build
```

Then open http://localhost:3000. The first build takes a few minutes. Stop it with `Ctrl+C`, and
use `docker compose down -v` if you want to start over with fresh demo data.

Docker Compose is for local development only. It uses known demo credentials (the default
database password and the demo users below), so it publishes ports on `127.0.0.1` only: the app
(3000) and the database (5432) can't be reached from other machines on your network.

### Running the backend and frontend yourself

Needs JDK 21, Node 22+ and Docker Desktop (for the database).

**Windows (PowerShell)**: run one line at a time from the project folder (Windows PowerShell
doesn't support `&&`).

```powershell
docker compose up -d postgres
cd backend
.\mvnw.cmd spring-boot:run
```

Then, in a second PowerShell window, from the project folder:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

(`npm.cmd` works even when PowerShell's execution policy blocks `npm.ps1`. Plain `npm` is fine if
your policy allows it.)

**macOS / Linux**:

```bash
docker compose up -d postgres
cd backend && ./mvnw spring-boot:run
cd frontend && npm install && npm run dev    # in a second terminal
```

Open http://localhost:5173. Either way, the database starts with a few days of sample trades.

### On local Kubernetes (kind)

The same three containers can also run on a local [kind](https://kind.sigs.k8s.io/) cluster
(Kubernetes inside Docker), using the manifests in [`k8s/`](k8s/). This is for your own machine
only: no registry, no cloud, and not a production setup. It needs Docker Desktop, kubectl (Docker
Desktop includes one) and kind (`winget install --id Kubernetes.kind -e`).

```powershell
docker build -t trade-platform-backend:local .\backend
docker build -t trade-platform-frontend:local .\frontend
kind create cluster --name trade-platform
kind load docker-image trade-platform-backend:local trade-platform-frontend:local --name trade-platform
kubectl apply -f k8s\00-namespace.yaml
$pgPassword = [guid]::NewGuid().ToString("N")
kubectl -n trade-platform create secret generic postgres-credentials --from-literal=password=$pgPassword
kubectl apply -f k8s\
kubectl -n trade-platform rollout status deployment/backend --timeout=300s
kubectl -n trade-platform rollout status deployment/frontend --timeout=120s
kubectl -n trade-platform port-forward service/frontend 3001:80
```

Then open http://localhost:3001. It uses port 3001 so it can run next to the Compose app on 3000.
The database password is generated into a Kubernetes Secret and never written to a file.

Limitations: there's one backend replica, because logins are sessions held in the backend's
memory; the demo users have a known password; and the database lives inside the kind cluster, so
deleting the cluster deletes the data. [k8s/README.md](k8s/README.md) explains each step, how to
check it's working, troubleshooting, and clean-up.

### Demo users

These are **local demo credentials** created by a database migration. All use the password `demo-pass`.

| User      | Role         | Entitled accounts            |
|-----------|--------------|------------------------------|
| `trader1` | Trader       | ACC-1001, ACC-1002, ACC-1004 |
| `trader2` | Trader       | ACC-1002, ACC-1003, ACC-1004 |
| `ops1`    | Operations   | (doesn't book trades)        |
| `risk1`   | Risk manager | (doesn't book trades)        |

Some things to try: as `trader1`, book 5,000 AAPL on ACC-1002 to see a risk rejection; as `ops1`,
run settlement; as `risk1`, change a limit and look at the audit log.

## Testing

Windows PowerShell, from the project folder:

```powershell
cd backend
.\mvnw.cmd test
```

```powershell
cd frontend
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
```

On macOS/Linux use `./mvnw test` and `npm test`. The backend tests start a real Postgres in Docker
(Testcontainers), so Docker needs to be running.

GitHub Actions ([`ci.yml`](.github/workflows/ci.yml)) runs on pushes to `main` and on pull
requests, in three jobs:

- **Backend**: compiles and runs all the tests with `./mvnw verify`.
- **Frontend**: lint, type-check, tests and a production build.
- **Docker Compose smoke test**: builds the images and starts the whole stack on a fresh database,
  then checks that every Flyway migration ran, the backend reports healthy, nginx serves the app,
  and a demo user can log in through the `/api` proxy.

## Implementation notes

The parts that took the most thought. Several are about two requests or jobs hitting the same
data at the same time.

**Concurrent daily limit checks.** Two trades for the same account arriving together could both
read the same "used today" total and both pass. The risk check locks the account's limit row
(`SELECT ... FOR UPDATE`), so checks for one account run one at a time. A test fires 8 trades at
once against a limit that only fits 4; without the lock, all 8 were accepted.

**Duplicate requests.** The trade form generates a `clientTradeId` once per trade, not per click.
Sending the same one again returns the original trade. If two identical requests race past the
"does it exist?" lookup, a unique constraint stops the second insert and the first trade is returned.

**Settlement can run twice.** Each trade settles in its own transaction, its status is re-checked
inside it, and `@Version` on the trade catches a cancel and a settle racing each other. A test
runs three settlement jobs at the same time and checks every trade settled exactly once.

**Money is never a floating-point number.** Prices, notionals and limits are `BigDecimal` in Java
and `NUMERIC` in Postgres, and the API sends them as JSON strings, because the largest allowed
limit has more digits than a JavaScript number holds exactly. The new trade form calculates its
notional preview with `BigInt` instead of multiplying JS numbers.

**Entitlements are checked first.** This happens before the duplicate lookup, so resubmitting an
existing trade can't get around it. An account code that doesn't exist gets the same 403 as one
you aren't entitled to, so the API doesn't reveal which accounts exist.

**Sessions instead of JWT.** There's only one backend, so login uses a normal Spring Security
session with an HttpOnly cookie instead of a token stored in the browser. Because the session is
a cookie, CSRF protection stays on.

More detail is in [docs/design-notes.md](docs/design-notes.md).

## Not done yet

- No market holiday calendar (weekends are skipped, holidays aren't).
- No login rate limiting, user management or screen for editing entitlements; users and
  entitlements come from migrations.
- Not deployed anywhere public. The Kubernetes manifests are for a local kind cluster only.
