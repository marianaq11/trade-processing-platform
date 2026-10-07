# Design notes

Notes on how the system behaves and why. The README has the short version.

## Scope

- US equities only, USD only, whole-share quantities.
- One Spring Boot app, one Postgres database, one React app.
- Trades are validated and risk-checked synchronously inside the submit request.

## Trade lifecycle

```
RECEIVED ──> VALIDATED ──> ACCEPTED ──> SETTLED
    │            │             │
    └> REJECTED <┘             └──> CANCELLED
```

| Status    | Meaning                                                          |
|-----------|------------------------------------------------------------------|
| RECEIVED  | Stored, nothing checked yet                                      |
| VALIDATED | Passed business validation                                       |
| REJECTED  | Failed validation or a risk check (final)                        |
| ACCEPTED  | Passed risk checks, waiting for its settlement date              |
| CANCELLED | Cancelled by operations before settlement (final)                |
| SETTLED   | Settled by the settlement job on or after its settlement date (final) |

Allowed transitions live in the `TradeStatus` enum, and `Trade` only changes status through
methods that check them. Every transition writes a row to `trade_event` with who did it and
why, which is the history shown on the trade page.

Because processing is synchronous, RECEIVED and VALIDATED only exist for a few milliseconds.
They're still recorded so the history shows which step a trade got to.

## Two kinds of "invalid"

1. **Bad request**: missing fields, negative quantity, unknown account or symbol.
   Returns 400 and nothing is stored. We can't attribute the trade to anything real.
2. **Business rejection**: the request is well formed, but e.g. the account is suspended
   or a risk limit is breached. The trade is stored as REJECTED with a reason code and the
   API still returns 201, because the trade was recorded. Rejecting it is a normal outcome,
   not an HTTP error.

## Risk checks

Per account, edited by risk managers:

- Price tolerance: price must be within X% of the instrument's reference price (a "fat finger"
  check). This runs first since a mistyped price usually explains a huge notional too.
- Max notional for a single trade.
- Max gross notional per trading day: today's ACCEPTED and SETTLED trades plus this one.
  Cancelled trades never settle, so they free their share of the limit back up.

An account with no limits configured gets every trade rejected (`NO_RISK_LIMITS`). Failing
closed seemed safer than letting unlimited trading through by accident.

The daily limit has a race: two trades for the same account could both read the same
running total and both pass. The risk check locks the account's `risk_limit` row
(`SELECT ... FOR UPDATE`) so checks for the same account run one at a time.
`RiskCheckIntegrationTest` fires 8 trades at once to check this. When I took the lock out,
all 8 got accepted against a limit that only fits 4.

## Changing limits, and the audit trail

`PUT /api/risk-limits/{account}` takes all three values plus a required reason and the
`version` the user loaded. Each field that actually changed gets a row in `risk_limit_change`
(old value, new value, reason, who, when). Saving without changes writes nothing.

The audit table is a plain table for this one purpose rather than a generic "audit framework".
Trade history already has its own table (`trade_event`), and those were the only two things
that needed an audit trail.

Two risk managers saving at the same time: the update takes the same row lock as the risk
check, then compares versions. The second save waits for the first, sees the version moved
and gets a 409 telling them who changed it, instead of silently overwriting.

A single-trade limit above the daily limit is rejected, since it could never be used.

## Duplicate submissions

Clients send a `clientTradeId` (the UI generates one per trade, not per click). It's unique per
account in the database.

- Same `clientTradeId`, same user, same details: return the existing trade (200)
- Anything else with a used `clientTradeId`: 409

The unique constraint is the real guard. The lookup beforehand handles the normal retry case
cheaply. When two identical requests race past the lookup, the second insert fails on the
constraint and the service looks the trade up again in a fresh transaction (the failed one has
already rolled back, which is why `submit` uses `TransactionTemplate` instead of `@Transactional`).

## Settlement

A scheduled job (weekdays, 6pm New York time) settles every ACCEPTED trade whose settlement
date is today or earlier. Operations can also start the same job by hand.

- "Today or earlier" means a missed run (server down over a weekend) catches up next time.
- Each trade settles in its own transaction, so one failure doesn't undo the rest.
- Each trade is re-checked inside its transaction because ops may have cancelled it since the
  job loaded the list. If the cancel and the settle race, `@Version` on `Trade` makes one of
  them fail cleanly rather than both "winning".
- Running it twice does nothing the second time, so overlapping runs are safe. There's a test
  that runs three at once against 12 trades and checks each trade settled exactly once.

## Dates and time zones

Trade dates are New York business dates, taken from an injected `Clock` set to
`America/New_York`. Settlement is T+1 (the US moved to T+1 in May 2024): weekends are skipped,
market holidays aren't modeled. The UI shows timestamps in New York time too, labelled ET, so a
late-evening trade doesn't look like it happened on the next day.

Integration tests swap in a `MutableClock`, so "today" is a fixed Monday unless a test moves it.

## Login and roles

Spring Security form login with a server-side session (HttpOnly, SameSite=Lax cookie). I went
with sessions over JWT because there's one backend, so there's no need for stateless tokens, and
it avoids storing a token in localStorage. Since the session lives in a cookie, CSRF protection
stays on: Spring sets an `XSRF-TOKEN` cookie and the frontend sends it back as a header.

| Role         | Can do                                        | Sees              |
|--------------|-----------------------------------------------|-------------------|
| TRADER       | Submit trades                                 | Own trades only   |
| OPERATIONS   | Cancel accepted trades, run settlement        | All trades        |
| RISK_MANAGER | Set and change risk limits, read the audit log | All trades       |

All the URL rules are in `SecurityConfig`. The frontend hides what a role can't use, but the
backend checks every request regardless. A trader asking for another trader's trade gets 404,
not 403, so trade ids can't be probed.

## Account entitlements

Roles say what kind of thing someone can do; entitlements say which accounts a trader can do
it on. It's one join table, `account_entitlement (user_id, account_id)`, mapped as a
`@ManyToMany` on `AppUser`. There's no generic permissions model because nothing else needs one.

- Submitting a trade checks the entitlement first, before the duplicate lookup, so resubmitting
  an existing `clientTradeId` can't be used to get around it.
- An account code that doesn't exist gets the same 403 as one the trader isn't entitled to, so
  the API can't be used to find out which accounts exist.
- `GET /api/accounts` only returns a trader's own accounts, which is also what fills the dropdown
  on the trade form. Operations and risk managers see every account.
- If an entitlement is removed, the trader can't book on that account any more but can still see
  the trades they booked on it before.
- A refused trade isn't stored as REJECTED. Rejections are for trades someone was allowed to
  book; this is an access check, so it's a 403 and nothing is saved.

Entitlements come from a migration; there's no admin screen for them.

## Input limits

Found by poking at the API with curl:

- Quantity must be a whole number. Jackson would otherwise turn 1.5 into 1 and book it.
- Price is capped at 9,999,999.9999 so that the largest allowed trade still fits the
  `NUMERIC(19,4)` notional column.
- Page numbers and page sizes are bounded; sorting only accepts a few named columns.

## Demo data

`db/demo/R__demo_data.sql` inserts a few days of trade history and some limit changes, relative
to today's date, so a fresh database has something to show (including settled trades, which
otherwise wouldn't appear until the next day). It only runs against empty tables and tests
don't load it.

## Docker

`docker compose up --build` runs three containers: Postgres, the backend jar, and nginx serving
the built React app. nginx also forwards `/api` to the backend, so the browser sees a single
origin, the same as with the Vite dev server's proxy. That matters because login uses a session
cookie and a CSRF cookie. The backend image skips tests because they need Docker themselves
(Testcontainers); CI runs them.

## Not done

- No market holiday calendar.
- No login rate limiting, password changes or user management; users come from a migration.
- Processing is synchronous. A background worker with retries would be the next step if the
  checks ever called slow external systems.
- Not deployed. Running behind HTTPS would also mean marking the session cookie `Secure`.
