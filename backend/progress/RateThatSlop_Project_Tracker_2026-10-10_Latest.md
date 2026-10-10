# Rate That Slop — Project Tracker

**Updated:** October 10, 2026 — deployment, Postman tests, and team-integration planning  
**Project:** Hackathon Chrome extension evaluating sewing-pattern listings for potential AI-generated or misleading content  
**My responsibility:** Backend, database, authentication, and integration with the Chrome extension

> **Status at a glance:** **DigitalOcean deployment SUCCEEDED and all currently implemented API routes passed their planned Postman checks**, including authenticated `/api/me`. Local Express, Supabase database, and backend authentication are working. **Next:** fetch teammates’ branches using GitHub Desktop, create an integration branch, review and merge their changes carefully, then build Chrome extension authentication logic alongside the teammate handling UI. Questionnaire implementation remains paused pending final form decisions.

## 1. Architecture

```text
Chrome extension (Manifest V3)
  ├─ Popup: login/signup (planned)
  ├─ Side panel: questionnaire (planned)
  ├─ Content/background/offscreen scripts (team implementation)
  └─ Local ONNX AI analysis (team implementation)
           │ HTTPS + JSON + Supabase access token
           ▼
Node.js / Express API
  ├─ Local: http://localhost:3000
  └─ Hosted: DigitalOcean App Platform (deployed and tested)
           │
           ▼
Supabase
  ├─ PostgreSQL database
  └─ Auth: email/password and user sessions
```

**Security boundary:** The Supabase **server secret/service-role key stays on the Express server only**. The Chrome extension can use a Supabase publishable key for authentication, and it sends a user access token with protected API requests. Express verifies the token and derives the user ID from it.

## 2. Completed work

### Backend foundation — COMPLETE
- Set up `backend/` as a Node.js + Express application (`npm start`).
- Configured `.env`, `dotenv`, CORS, and `@supabase/supabase-js`.
- Created `backend/config/supabase.js` for the server-side Supabase client.
- `GET /api/health` responds locally and confirms Express is running.
- `GET /api/test-db` verified the backend can query Supabase (temporary debugging endpoint).
- `GET /api/patterns/:platform/:listingId` returns a matching pattern or `404`.
- Tested with `demo_store / TEST-001` (Summer Dress Sewing Pattern).

### Supabase PostgreSQL — COMPLETE
Created and tested five tables:

| Table | Purpose |
|---|---|
| `profiles` | Application profile tied to `auth.users.id` |
| `patterns` | Listing identifier, source platform, title, URL |
| `reports` | One user's questionnaire response per pattern, with JSONB answers |
| `score_snapshots` | Individual component scores and aggregate score per assessment |
| `image_analyses` | Per-image AI score, associated with a score snapshot |

- Added relationships, uniqueness constraints, relevant indexes, and row-level security (RLS).
- Granted needed `service_role` database privileges; most recently ran `GRANT SELECT, INSERT, UPDATE ON public.profiles, public.patterns, public.reports TO service_role;`.
- Tested table creation, score snapshot/image-analysis inserts inside a rolled-back SQL transaction, and RLS status.
- Created a trigger to automatically insert a `profiles` row for newly registered Supabase Auth users.
- Backfilled an earlier test user and verified `auth.users.id` matches `profiles.id`.
- Kept the local database schema in `backend/database/schema.sql` (check that the latest grant statement is recorded there).

### Authentication — COMPLETE (backend testing)
- Configured Supabase Auth for email/password; email confirmation enabled for regular signups.
- Created a test user.
- Implemented `backend/middleware/auth.js` to require a Bearer token, verify it through Supabase Auth, and attach the authenticated user to the Express request.
- Added protected `GET /api/me` endpoint.
- Tested no-token request: correctly responds `401 Authentication required`.
- Tested login using a temporary script with the publishable key and test credentials: login succeeded; authenticated `/api/me` returned HTTP `200` and the expected user identity.
- **Still needed:** Chrome popup login/signup and persistent session handling.

### Git/GitHub collaboration — COMPLETE for deployment setup
- Team's original repo: `StarcraftOmega/RateThatSlop`.
- Your fork: `SindhujaSesham/RateThatSlop`.
- Development/deployment branch: `Sindhu-branch` (use this actual name, not the earlier placeholder `Myname-branch`).
- Local remotes: `origin` → team repo; `fork` → personal fork.
- Successfully pushed `Sindhu-branch` to the fork without merging it into either repository's `main`.
- No pull request or main-branch merge was required to do this.

## 3. DigitalOcean deployment — COMPLETE (October 10, 2026)

**Provider chosen:** DigitalOcean App Platform (managed Node.js hosting).  
**Goal:** Host the Express API online so the extension and teammates can use it without localhost.

### Configuration selected

| Setting | Selected/expected value |
|---|---|
| GitHub source | `SindhujaSesham/RateThatSlop` |
| Branch | `Sindhu-branch` |
| Source directory | `backend` (entered and confirmed; detection succeeded) |
| Autodeploy | OFF (manual deployments for demo stability) |
| Component type | Web Service |
| App name | `rate-my-slop` |
| Build strategy | Buildpack |
| Build command | Not specified (automatic dependency installation) |
| Run command | `npm start` |
| Public HTTP port | `8080` |
| Health check | HTTP `GET /api/health` (changed from TCP) |
| HTTP route | Should be `/` |
| CPU/size | Shared CPU, $5/month, 512 MB RAM, 1 shared vCPU |
| Containers | 1; autoscaling off |
| External DB | Existing Supabase; no DigitalOcean database needed |
| DigitalOcean project | `first-project` |

### Environment variables
Added to DigitalOcean's backend component (verify names match code and the secret is encrypted):
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — backend secret/service-role key (**encrypted**, never commit/share)
- `PORT=8080`
- `SUPABASE_PUBLISHABLE_KEY` — appears in deployment build log; confirm purpose/scope as needed
- `NODE_ENV=production` — **not confirmed** in the shown build log (build log displayed `NODE_ENV=`); confirm before assuming set

The app-level environment variable area can remain empty if these are already component-level values. Don't add a DigitalOcean database.

### Important code/deployment check
`backend/server.js` should use the host-provided port and bind externally, for example:

```js
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Confirmed:** updated `server.js` was committed and pushed to the fork's `Sindhu-branch`, at commit `3fb94e7` (short hash). With autodeploy off, code pushes alone do not initiate deployments; app configuration edits may still automatically trigger deployments.

### Deployment troubleshooting and resolution (October 10)

1. The initial DigitalOcean deployment failed readiness/health checks. Its runtime reported `Server running at http://localhost:3000` while the probe attempted port `8080`, yielding `connect: connection refused`.
2. Inspected `backend/server.js`. At one point a pasted `app.listen(...)` had been inserted before `const app = express()` while another `app.listen(...)` remained at the bottom. Corrected the file so it has **one** listener, after all middleware/routes:

   ```js
   const app = express();
   const PORT = process.env.PORT || 3000;
   // ... register routes ...
   app.listen(PORT, "0.0.0.0", () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

3. Kept `GET /api/health` active with `res.status(200).json({ status: "ok" })`. Removed redundant active listener (older health handler may remain commented out).
4. Verified local `npm start` and then `PORT=8080 npm start` successfully started the server. Browser test of `http://localhost:8080/api/health` returned `{"status":"ok"}`. Local `.env` may set `PORT=3000` for development; that **does not need to match** DigitalOcean's component `PORT=8080`.
5. Verified Git setup after canceling an unnecessary GitHub Desktop clone attempt: on `Sindhu-branch`, clean working tree, `origin` = team repository, `fork` = personal repository. Branch tracks `origin/Sindhu-branch`, **but pushes for deployment must explicitly use** `git push fork Sindhu-branch`.
6. Committed server startup fix and pushed it successfully: `b3a709b..3fb94e7  Sindhu-branch -> Sindhu-branch`. Confirmed updated `server.js` was visible in the fork on GitHub.
7. DigitalOcean component settings confirmed: correct fork/branch/source directory, run command `npm start`, public HTTP port `8080`, and component `PORT=8080`. Having `8080` in both the public HTTP port and `PORT` environment variable is correct. App-level environment variables were empty, which is okay when component-level variables are set.
8. Changed health check from **TCP** to **HTTP** with path **`/api/health`** (leading slash required). This configuration change triggered another deployment automatically.
9. That deployment still failed because the inspected **build log showed old commit `b3a709b244f58edc18817136b450f527291af4d4`** being checked out. Build/dependencies themselves succeeded, but runtime still printed the old `localhost:3000` startup message and health checks against `8080` failed. A later deploy log also showed the old startup message. The team confirmed the fork's current `server.js` already had the corrected code.
10. Initiated a fresh rebuild/deployment using updated source. **User reported the deployment succeeded.** The exact successful deployment commit was not pasted back, so its hash should be independently recorded from DigitalOcean activity if needed.

### Hosted Postman API tests — ALL PLANNED TESTS PASSED (user-confirmed)

Created a Postman collection for the deployed API using a `baseUrl` variable for the public DigitalOcean address. Tested these calls against the **hosted backend**, not merely localhost:

| Request | Expected HTTP status | Result |
|---|---:|---|
| `GET /api/health` | `200` | Passed; JSON includes `"status":"ok"` |
| `GET /api/test-db` | `200` | Passed; Supabase database connection |
| `GET /api/patterns/demo_store/TEST-001` | `200` | Passed; known test pattern retrieved |
| `GET /api/patterns/demo_store/DOES-NOT-EXIST` | `404` | Passed; missing pattern handled correctly |
| `GET /api/me` without Bearer token | `401` | Passed; protected endpoint rejects unauthenticated request |
| `POST https://<supabase-project>.supabase.co/auth/v1/token?grant_type=password` | `200` | Passed; email/password login through Supabase Auth |
| `GET /api/me` with Supabase user Bearer `access_token` | `200` | Passed; authenticated identity returned by hosted Express API |

**Auth test details:** The first Supabase login attempt returned `400 invalid_credentials` because the Postman raw JSON body did **not yet contain** the test user's email and password. Confirmed the test account existed and email was verified; after supplying those fields, the login request succeeded. Passed the resulting **user access token** to Postman's Bearer Token authentication for `/api/me` and received `200`. This validates the deployed authentication path. **Never paste or commit credentials, tokens, refresh tokens, or the service-role secret.** Keep Postman credentials in private/local or secret variables and avoid sharing the collection with values included.

**Still to verify:** Chrome extension → deployed API integration, signup/logout/session refresh from the extension, detailed production runtime review, and future report/scoring routes (not implemented). The exact public app URL was not provided in chat—copy it from DigitalOcean and record it here when available: `PUBLIC_API_BASE_URL=<your real HTTPS URL>` (placeholder only).

**Reliability decision:** Avoid sleeping free hosting for judging. The $5 shared-CPU service runs a single container, so it is not redundant/high availability; rehearse on the public API and keep a recorded backup demo.

## 4. Questionnaire — DESIGN IN PROGRESS, IMPLEMENTATION PAUSED

**Agreed direction:** Separate questions anyone can assess from a listing versus hands-on questions that require the user to have actually tried the sewing pattern. Skipped answers should be absent, **not silently converted to `false`**.

### Current draft of form (not fully finalized)

**Everyone:**
- Have you tried this pattern? Yes/No.
- Fabric suggestion present? Yes/No.
- Real-life photo present? Yes/No; if yes, does it look real?
- Is it a clothing pattern? Yes/No.

**If tried:**
- Were measurements off?
- Did the suggested fabric work / make sense? (only if fabric suggestion present)
- Were written instructions poorly written?

**If clothing:**
- Is a size chart present?
- Garment type: dress, skirt, pants, shorts (whether to include `Other` is undecided).
- If chart present, which measurements are included? Dress: bust/waist/hips; skirt: waist/hips; pants/shorts options not yet finalized.
- Is a line drawing present? If yes, does it match the garment?

**Outstanding form decisions:**
1. Measurement choices for pants and shorts (include rise or not?).
2. Whether to support garment type `Other` (and a text field).
3. Whether subjective questions allow `Not sure` in addition to Yes/No.
4. Whether to add optional free-text comments.

### Proposed API data model
`POST /api/reports` request would contain `source_platform`, `external_listing_id`, `pattern_tried`, `garment_type`, `questionnaire_version: 1`, and `answers` (JSON object). Authentication token goes in the `Authorization: Bearer ...` header; **do not accept a client-supplied user ID as authority**.

**Not implemented yet:** `backend/validators/questionnaire.js`, working `POST /api/reports`, report retrieval/edit endpoints, Chrome side panel, and end-to-end questionnaire submissions. There was proposed code, but implementation was explicitly paused to finalize questions and focus on deployment. Check whether any empty/skeleton files already exist in the repo.

## 5. Remaining work — suggested order

### A. Deployment — completed / remaining verification
- [x] DigitalOcean deployment succeeded
- [x] Hosted health check passed
- [x] Hosted Supabase database test passed
- [x] Hosted `/api/me` correctly rejects requests without auth
- [x] Port and HTTP health-check configurations confirmed
- [x] Updated server listener committed and pushed to personal fork
- [ ] Record exact deployed public API URL and successful deployment commit
- [x] Test hosted existing/missing pattern lookups and authenticated `/api/me` with a valid user token using Postman
- [ ] Verify production env/secret scopes and whether `NODE_ENV` is set
- [ ] Decide whether/when to connect hackathon domain

### B. Team branch integration and Chrome extension authentication (NEXT PRIORITY)
- [ ] Fetch latest team commits/branches using GitHub Desktop (not yet confirmed completed)
- [ ] Identify teammates’ two actual branch names and inspect their changed files
- [ ] Create `integration/extension` **from clean `Sindhu-branch`** (not yet created)
- [ ] Merge one teammate branch at a time into the integration branch; resolve conflicts and test after each
- [ ] Keep the deployed `Sindhu-branch` unchanged; push integration branch only to personal fork when ready
- [ ] After integration, create `feature/extension-auth` from the integrated code for auth work (not yet created)
- [ ] Coordinate with teammate working on popup UI: agree on function names, inputs, results, loading/error states, and ownership of UI vs auth logic
- [ ] Inspect current extension structure before editing teammates' code; auth functionality is your responsibility, UI is likely owned by another teammate
- [ ] Implement reusable Supabase Auth helper for extension signup, sign-in, sign-out, and session restoration/refresh
- [ ] Sync carefully with team's current main branch, without overwriting teammates' changes
- [ ] Pick a central API client/config for extension (localhost for development vs public HTTPS for demo)
- [ ] Add API host permissions to Manifest V3 configuration
- [ ] Route API requests through extension background service worker or extension pages (avoid directly fetching from page content scripts where origin/CORS differs)
- [ ] Implement popup signup/login, session storage, token refresh
- [ ] Test extension → hosted API → Supabase with signed-in user

### C. Finalize questionnaire and reports
- [ ] Decide the four outstanding form details above
- [ ] Document final field names and conditional behavior
- [ ] Implement `validators/questionnaire.js`
- [ ] Implement authenticated `POST /api/reports` with validation and find/create pattern logic
- [ ] Enforce authenticated ownership and one-report-per-user-per-pattern semantics; handle updates safely
- [ ] Implement read/edit report endpoints and side-panel questionnaire
- [ ] Test valid/invalid submissions and end-to-end persistence

### D. Scoring, hardening, and judging
- [ ] Implement score snapshot and image analysis routes with appropriate permissions
- [ ] Decide which scoring submissions are trusted (extension-submitted AI scores can be modified by clients)
- [ ] Coordinate teammate scoring algorithm and listing identifier contract
- [ ] Remove/protect temporary debug endpoints and temporary test login credentials/script
- [ ] Verify limited CORS/host permissions and never expose backend secret
- [ ] Test deployment and integrations on the actual browser extension
- [ ] Rehearse judging demo; record backup walkthrough; avoid last-minute deployments
- [ ] Merge tested feature work to the team's original repo using a reviewed pull request

## 6. Useful local commands

From the **repository root**:

```bash
git branch --show-current
git remote -v
git status
# Push the current backend branch to YOUR fork (not original team main)
git push fork Sindhu-branch
```

From **`backend/`**:

```bash
npm install
npm start
```

Local endpoint examples:

```text
GET http://localhost:3000/api/health  # local default; use PORT=8080 npm start to emulate hosting
GET http://localhost:3000/api/patterns/demo_store/TEST-001
GET http://localhost:3000/api/me         # 401 if not authenticated
```

## 7. Notes to future me

- Development and deployment are **not the same branch as the team's `main`**. Avoid accidental main-branch merges.
- `git push origin` targets the **team repo**; `git push fork Sindhu-branch` targets the **personal fork**.
- With DigitalOcean **Autodeploy OFF**, manually deploy intentionally after pushing code. **Editing app configuration can still trigger a deployment**; check that the build selects the latest commit (not a previous revision).
- Supabase is already hosted; you do **not** need to migrate databases or add one at DigitalOcean.
- A DigitalOcean container runs **Express only**, not the Chrome extension's local ONNX model.
- `reports.answers` is JSONB; conditional unanswered fields should be omitted.
- Preserve/commit schema changes as SQL in the repository, not just in Supabase's dashboard.
- The extension's client-safe publishable key is different from the backend's secret/service-role key.
- Never place passwords, tokens, or secret keys in README, GitHub commits, screenshots, or chat.
- `PORT=3000` in **local** `.env` and `PORT=8080` in **DigitalOcean component env** is intentional; Docker/App Platform needs the process to listen on the configured HTTP port.
- If readiness probes fail again, compare the runtime startup port, check path, and **build-log Git checkout commit** before changing code.
- Hosted `/api/me` has now passed **both** unauthenticated (`401`) and valid-token (`200`) Postman tests; Chrome extension integration is still outstanding.

---

### Progress log template (append when you finish a step)

```text
Date:
Completed:
Files/commands changed:
Test result:
Next action:
Blockers:
```

### Progress log — October 10, 2026: first successful hosting deployment

```text
Completed: Fixed Express listener placement/host binding; verified local port 8080; pushed commit 3fb94e7 to personal fork; configured HTTP /api/health; diagnosed an old-commit build; fresh deployment succeeded; hosted health, DB, and unauthenticated /api/me checks passed.
Files/commands changed: backend/server.js; git push fork Sindhu-branch; DigitalOcean component health-check settings.
Test result: Live backend reachable and can query Supabase; full planned Postman suite subsequently passed, including authenticated `/api/me`.
Next action: Fetch and inspect teammates’ branches in GitHub Desktop, integrate on a separate branch, then implement auth helper and session handling.
Blockers: No current deployment blocker. Public app URL and exact successful deployment commit still need recording.
```


## 8. GitHub Desktop team integration plan — PLANNED, NOT YET MERGED

**Why:** Another teammate is working on the Chrome extension UI, and other teammates have their own branches. Before writing the extension's Supabase login/signup/session module, incorporate current teammates' code safely so the auth module fits the real UI structure. The user prefers **GitHub Desktop** over the VS Code terminal for the upcoming Git operations.

**Verified state immediately before fetching:** `Sindhu-branch` was the checked-out branch; `git status` reported `nothing to commit, working tree clean`, with tracking `origin/Sindhu-branch`. The prior canceled GitHub Desktop fork clone did not disturb the existing repository. The existing remotes are:

| Remote | Repository | Purpose |
|---|---|---|
| `origin` | `StarcraftOmega/RateThatSlop` | Team repository; teammates’ branches |
| `fork` | `SindhujaSesham/RateThatSlop` | Personal fork; safe destination for your pushes |

**Agreed workflow:**

1. In GitHub Desktop, confirm the repository is `RateThatSlop` and current branch is `Sindhu-branch`.
2. Click **Fetch origin**. Fetch should not merge or alter the working files. **Do not click Pull** just because GitHub Desktop offers it afterward; first inspect the state and branches. The user asked whether it was safe to fetch, and was told yes; **no confirmation yet that fetch has been performed**.
3. Open **Current Branch**, find the teammates’ branches, and record their exact names. If branches aren't visible, confirm how GitHub Desktop fetched the team `origin` remote; GitHub Desktop's 'origin' naming can be confusing with this two-remote setup.
4. From the clean `Sindhu-branch`, create local **`integration/extension`** as a protected workspace for combining changes. This name was proposed, not yet created.
5. Inspect each teammate branch and merge it into **`integration/extension`** **one at a time**; address conflicts, build/test, then proceed to the next branch. Do **not** merge teammates directly into `Sindhu-branch` or team `main` during experimentation.
6. When verified, push the integration branch to your personal fork (not team `origin`). Don't change DigitalOcean's deployment source branch without a conscious decision.
7. Develop browser-extension authentication on a subsequent **`feature/extension-auth`** branch based on the integrated code; keep client-side auth logic outside `backend/` and coordinate the interface with the teammate implementing the popup UI.

**Current known limitations:** Two teammate branch names have not been supplied; no fetch/merge result has been reported, and the extension directory/manifest files haven't yet been inspected. Avoid claiming branch integration is done.

## 9. Suggested next tasks and acceptance checks

- [x] Host the API successfully on DigitalOcean and verify health, database, pattern lookup, missing-pattern behavior, and authenticated/unauthenticated access with Postman.
- [ ] Confirm **Fetch origin** in GitHub Desktop and list available teammate branches.
- [ ] Create a clean integration branch, merge reviewed teammates' changes individually, and test the combined extension.
- [ ] Agree with UI teammate on auth function signatures and form state handling (login/signup/logout, errors, signed-in status).
- [ ] Implement extension-only Supabase Auth using publishable key and secure session storage/refresh; never embed service-role key.
- [ ] Verify Chrome extension's login, persistence, logout, and authenticated API access against deployed `GET /api/me`.
- [ ] Finalize questionnaire questions; implement and test authenticated report submission and remaining scoring APIs.
- [ ] Restrict or remove public `/api/test-db` before judging; verify secrets, CORS, and release checklist.

### Progress log — October 10, 2026: Postman success and team branch planning

```text
Completed: All planned Postman API checks passed (health, DB, known pattern, nonexistent pattern, unauthorized /api/me, Supabase password login, authenticated /api/me).
Issue resolved: Initial password-login 400 invalid_credentials was caused by leaving email/password out of request JSON; retest succeeded when supplied.
Git status: Clean Sindhu-branch; origin is team repo; fork is personal repo; existing deployed branch remains untouched.
Integration decision: Work from a new integration/extension branch based on Sindhu-branch; fetch teammate branches via GitHub Desktop; merge individually and test; later branch feature/extension-auth for authentication logic.
Not yet done: GitHub Desktop fetch confirmation, teammate branch names, integration branch creation, merges, Chrome extension auth implementation.
Next action: Fetch origin with GitHub Desktop, inspect Current Branch menu, and record teammates' branch names.
```
