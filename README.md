# Trade Processing Platform

A simplified trade-processing system: submit an equity trade, and it gets validated,
checked against per-account risk limits, and accepted or rejected with a reason. Every
status change is recorded so you can see exactly what happened to a trade.

Built with Java 21 / Spring Boot, PostgreSQL, and React + TypeScript.

Work in progress. See [docs/design-notes.md](docs/design-notes.md) for how the lifecycle
and risk checks work.

## Running locally

You need JDK 21, Node 22+, and Docker. Maven comes from the wrapper (`mvnw`).

```bash
docker compose up -d          # Postgres on localhost:5432

cd backend
./mvnw spring-boot:run        # API on localhost:8080

cd frontend
npm install
npm run dev                   # UI on localhost:5173, proxies /api to the backend
```

Backend tests use Testcontainers, so Docker needs to be running for `./mvnw test`.
