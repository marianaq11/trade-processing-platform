# Running on local Kubernetes (kind)

These manifests run the same three containers as `docker-compose.yml` (PostgreSQL, the Spring Boot
backend, and the React frontend behind nginx) on a [kind](https://kind.sigs.k8s.io/) cluster, which
is Kubernetes running inside Docker on your own machine. The images are built locally and loaded
straight into the cluster, so there is no registry, cloud account or Helm chart involved.

> **Local only.** The database migrations create demo users with a published password
> (`demo-pass`), the app is served over plain HTTP, and the database has no backups. Don't expose
> this deployment beyond your own machine or treat it as a production setup.

## What's in this folder

| File | Creates |
|---|---|
| `00-namespace.yaml` | The `trade-platform` namespace that holds everything else |
| `10-postgres.yaml` | A 1 GiB PersistentVolumeClaim, the PostgreSQL 17 Deployment, and the `postgres` Service |
| `20-backend.yaml` | The backend Deployment (one replica) and the `backend` Service |
| `30-frontend.yaml` | The nginx + React Deployment and the `frontend` Service |

The files are numbered so `kubectl apply -f k8s\` creates the namespace first. None of the Services
are reachable from outside the cluster; you open the frontend with `kubectl port-forward`.

How the pieces find each other:

- The backend connects to `jdbc:postgresql://postgres:5432/trades`, where `postgres` is the
  Service name, resolved by the cluster's DNS.
- `frontend/nginx.conf` proxies `/api/` to `http://backend:8080`. The backend Service is named
  `backend` so the same frontend image works unchanged in Docker Compose and Kubernetes. Your
  browser only talks to nginx, so the session cookie and CSRF token behave exactly as they do under
  Compose.
- The database password lives in a Secret named `postgres-credentials`, which you create in step 3.
  It's not in git.

Health checks:

| Container | Startup | Readiness | Liveness |
|---|---|---|---|
| postgres | `pg_isready` over TCP | `pg_isready` over TCP | `pg_isready` over TCP |
| backend | `GET /actuator/health` (up to 3 min for Flyway) | `GET /actuator/health` (includes the database) | TCP connect to port 8080 |
| frontend | – | `GET /` | `GET /` |

The backend also has a `wait-for-postgres` init container, so on first deploy it waits for the
database instead of crashing and restarting while Postgres runs `initdb`.

## Prerequisites

- **Docker Desktop**, running.
- **kubectl**. Docker Desktop includes one; if `kubectl version --client` doesn't work, run
  `winget install --id Kubernetes.kubectl -e`.
- **kind**:

  ```powershell
  winget install --id Kubernetes.kind -e
  ```

  Then open a **new** PowerShell window so it's on your `PATH`, and check:

  ```powershell
  kind version
  kubectl version --client
  ```

All commands below are Windows PowerShell, run from the project folder. Run them one line at a time.

## 1. Build the images

```powershell
docker build -t trade-platform-backend:local .\backend
docker build -t trade-platform-frontend:local .\frontend
```

These are new tags, so your Docker Compose images and containers are left alone.

## 2. Create the cluster and load the images

```powershell
kind create cluster --name trade-platform
kind load docker-image trade-platform-backend:local trade-platform-frontend:local --name trade-platform
```

The first `kind create cluster` downloads the kind node image, which takes a few minutes. It also
switches kubectl to the new cluster (context `kind-trade-platform`). If you later switch to another
cluster, switch back with `kubectl config use-context kind-trade-platform`.

The manifests use `imagePullPolicy: Never`, so Kubernetes never tries to download these two
images; they must be loaded with `kind load`.

## 3. Create the namespace and the database Secret

```powershell
kubectl apply -f k8s\00-namespace.yaml
$pgPassword = [guid]::NewGuid().ToString("N")
kubectl -n trade-platform create secret generic postgres-credentials --from-literal=password=$pgPassword
Remove-Variable pgPassword
```

This makes a random password that's only stored in the cluster. You never need to type it: both
Postgres and the backend read it from the Secret.

Postgres only reads the password the first time it creates its data directory. Keep this Secret
for as long as you keep the data; if you replace it, see "password authentication failed" under
[Troubleshooting](#troubleshooting).

## 4. Deploy and wait for it to start

```powershell
kubectl apply -f k8s\
kubectl -n trade-platform rollout status deployment/postgres --timeout=180s
kubectl -n trade-platform rollout status deployment/backend --timeout=300s
kubectl -n trade-platform rollout status deployment/frontend --timeout=120s
kubectl -n trade-platform get pods,services,pvc
```

All three pods should show `1/1 Running`, and the PVC `Bound`. On a fresh database, Flyway runs
the migrations (including the demo data) as the backend starts.

## 5. Open the app

```powershell
kubectl -n trade-platform port-forward service/frontend 3001:80
```

Leave that window open (`Ctrl+C` stops it) and go to http://localhost:3001. Sign in with the
demo users from the main README, for example `trader1` / `demo-pass`.

Port 3001 means this can run next to the Docker Compose app on port 3000. Browsers share cookies
between ports on the same host, though, so signing in on one logs you out of the other. To use
both at once, open the Kubernetes one as http://127.0.0.1:3001 or in a private window.

## Checking that it works

Flyway migrations, from the database (8 rows, all `success = t`):

```powershell
kubectl -n trade-platform exec deploy/postgres -- psql -U trades -d trades -c "SELECT installed_rank, script, success FROM flyway_schema_history ORDER BY installed_rank;"
```

Backend health, from inside its pod (`{"groups":["liveness","readiness"],"status":"UP"}`):

```powershell
kubectl -n trade-platform exec deploy/backend -- curl -s http://localhost:8080/actuator/health
```

Login through nginx, with the session cookie and CSRF token, while the port-forward is running.
This uses `curl.exe`, because plain `curl` in Windows PowerShell is a different command:

```powershell
$jar = (New-TemporaryFile).FullName
curl.exe -s -o NUL -w "%{http_code}`n" -c $jar http://localhost:3001/api/auth/me
$csrf = (Select-String -Path $jar -Pattern 'XSRF-TOKEN\s+(\S+)').Matches[0].Groups[1].Value
curl.exe -s -o NUL -w "%{http_code}`n" -b $jar -c $jar -H "X-XSRF-TOKEN: $csrf" --data-urlencode "username=trader1" --data-urlencode "password=demo-pass" http://localhost:3001/api/auth/login
curl.exe -s -b $jar http://localhost:3001/api/auth/me
curl.exe -s -b $jar http://localhost:3001/api/accounts
Remove-Item $jar
```

Expect `401` (not signed in yet; this response sets the CSRF cookie), then `204` (signed in), then
`{"username":"trader1","role":"TRADER"}` and trader1's accounts.

In the UI, as `trader1`: BUY 100 AAPL at 230.00 on ACC-1001 is accepted; BUY 5,000 AAPL at 230.00
on ACC-1002 is rejected as over the single-trade limit.

To see the readiness probe at work, stop the database and watch the backend become `0/1` without
restarting, then come back once Postgres returns with its data still there:

```powershell
kubectl -n trade-platform scale deployment/postgres --replicas=0
kubectl -n trade-platform get pods -w
kubectl -n trade-platform scale deployment/postgres --replicas=1
```

(`get pods -w` keeps watching; press `Ctrl+C` to stop it. The backend turns `0/1` after about 30
seconds.)

## After changing the code

Rebuild, load the new image, and restart the pods so they pick it up (the tag stays `:local`):

```powershell
docker build -t trade-platform-backend:local .\backend
kind load docker-image trade-platform-backend:local --name trade-platform
kubectl -n trade-platform rollout restart deployment/backend
kubectl -n trade-platform rollout status deployment/backend --timeout=300s
```

Same for the frontend, with `frontend` in place of `backend`. Restarting the backend signs
everyone out, because sessions are kept in its memory.

## Troubleshooting

Start with:

```powershell
kubectl -n trade-platform get pods
kubectl -n trade-platform describe pod -l app=backend
kubectl -n trade-platform logs deploy/backend
kubectl -n trade-platform get events --sort-by=.lastTimestamp
```

| Symptom | Cause and fix |
|---|---|
| `kind` or `kubectl` not recognized | Open a new PowerShell window after installing, so `PATH` is reloaded. |
| `ErrImageNeverPull` | The image isn't in the cluster. Run the `kind load docker-image` command from step 2, then `kubectl -n trade-platform rollout restart deployment/backend` (or `frontend`). |
| `kind load` fails with a "content digest not found" error | Some Docker Desktop setups need the archive route: `docker save -o backend.tar trade-platform-backend:local`, then `kind load image-archive backend.tar --name trade-platform`. |
| `CreateContainerConfigError` | The `postgres-credentials` Secret is missing. Create it (step 3); the pods start on their own once it exists. |
| Backend stuck at `Init:0/1` | It's waiting for Postgres. Check `kubectl -n trade-platform get pods -l app=postgres` and `kubectl -n trade-platform logs deploy/postgres`. |
| Backend logs say `password authentication failed for user "trades"` | The Secret was replaced after Postgres had already initialized its data with the old password. Put the old password back, or start over with fresh data (see "Clean up", then repeat steps 3–4). |
| Frontend `CrashLoopBackOff`, logs say `host not found in upstream "backend"` | nginx starts only if the `backend` Service exists. Run `kubectl apply -f k8s\`, then `kubectl -n trade-platform rollout restart deployment/frontend`. |
| Port-forward says the address is already in use | Something else has port 3001. Use another port, e.g. `3002:80`, and open http://localhost:3002. |
| Port-forward stops with "lost connection to pod" | The frontend pod was restarted or replaced. Run the port-forward command again. |
| Signed out of the Compose app on port 3000 | Shared `localhost` cookies; see step 5. |
| `kind create cluster` says the cluster already exists | It's still there from last time. Skip that command, or delete it first (see "Clean up"). |

## Clean up

Remove the app and its database (the PVC is deleted with the namespace):

```powershell
kubectl delete namespace trade-platform
```

Remove the whole kind cluster:

```powershell
kind delete cluster --name trade-platform
```

Neither command touches Docker Compose: its containers and its `pgdata` volume are separate.

## Limitations

- **Local and demo only.** Demo users with a known password, plain HTTP, no Ingress or TLS. The
  frontend is only reachable through `kubectl port-forward`, which listens on `localhost`.
- **One backend replica.** Logins are Spring Security sessions held in the backend's memory, so
  a second replica wouldn't recognize sessions from the first, and a restart signs everyone out.
  Scaling out would need a shared session store (such as Spring Session JDBC), and the scheduled
  settlement job would then run on every replica.
- **Single Postgres with node-local storage.** kind's default StorageClass keeps the volume inside
  the kind node container. Data survives pod restarts, but is deleted with the namespace or the
  cluster, and there are no backups or replicas.
- **Probe endpoints.** `SecurityConfig` only lets `/actuator/health` through without a login.
  Spring Boot's dedicated `/actuator/health/liveness` and `/readiness` endpoints answer 401 to
  the kubelet, so readiness uses `/actuator/health` (which includes the database check) and
  liveness is a TCP check. Allowing `/actuator/health/**` would let the probes use the dedicated
  endpoints, but that is a security change and was left out of this deployment.
- **Secrets are stored base64-encoded, not encrypted.** Fine for a throwaway local cluster; a real
  one would encrypt etcd or use an external secret store.
- **No registry.** Images are tagged `:local` and loaded with `kind load`, so each rebuild needs
  a reload and a `rollout restart`.
