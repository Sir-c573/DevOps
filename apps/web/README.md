# Coffee Corner — Frontend (`apps/web`)

The customer-facing web app for Coffee Corner. It shows the drinks menu and lets a customer place an order. It is a single-page app built with **React 19**, **TypeScript**, and **Vite 6**, and in Docker it is served by **Nginx**.

This document explains how the frontend works: in the code, locally, in Docker, and in the Git repository's CI/CD pipeline. For the whole project's DevOps setup, see [`DEVOPS.md`](../../DEVOPS.md).

## How the app works

```text
Browser
  |
  |  GET /            -> index.html + JS/CSS bundle (built by Vite)
  |  GET /api/menu    -> list of drinks
  |  POST /api/orders -> { "itemId": "espresso" }
  v
Nginx (web container, port 8080)
  |
  |  /api/*  is proxied to  http://api:3000/api/*
  v
NestJS API (api container, port 3000)
```

1. `index.html` loads `src/main.tsx`, which mounts the `<App />` component into `#root`.
2. On load, `MenuSection` (through the `useMenu` hook) calls `GET /api/menu` and renders one `DrinkCard` per drink. While waiting it shows "Brewing up the menu…"; if the request fails it shows an error with a **Try again** button, and an empty menu shows "The menu is empty right now."
3. Clicking **Order this** sends `POST /api/orders` with the drink's `itemId`. The API's message ("Order placed!" or an error) is shown above the menu. While an order is in flight, all order buttons are disabled.
4. The frontend always calls the API with a **relative path** (`/api/...`). It never needs to know the API's address: in development Vite forwards `/api` to the API, and in Docker Nginx does.

## Project structure

```text
apps/web/
├── index.html        # HTML entry point (page title, meta tags, #root)
├── nginx.conf        # Nginx config used by the Docker image
├── package.json      # @coffee/web workspace: scripts and dependencies
├── tsconfig.json     # Strict TypeScript settings
├── vite.config.ts    # React plugin + /api dev proxy to localhost:3000
└── src/
    ├── main.tsx      # Mounts <App /> in React StrictMode
    ├── App.tsx       # Page layout: Header, Hero, MenuSection, Footer
    ├── api.ts        # fetchMenu() and placeOrder(): all calls to the API
    ├── types.ts      # Shared types (Drink, Notice)
    ├── hooks/
    │   ├── useMenu.ts    # Loads the menu; loading/error state and reload()
    │   └── useOrder.ts   # Places an order; tracks in-flight order and notice
    ├── components/
    │   ├── Header.tsx
    │   ├── Hero.tsx
    │   ├── MenuSection.tsx  # Feedback messages, retry, empty state, grid
    │   ├── DrinkCard.tsx    # One drink: icon, number, price, order button
    │   └── Footer.tsx
    └── styles.css    # All styling
```

Rule of thumb: components only render, hooks hold state, and `api.ts` is the only file that calls `fetch`.

The repository is an **npm workspace** (`apps/api` and `apps/web`), so dependencies are installed once from the repository root with a single `package-lock.json`.

## Running it locally

Node.js 22 is required. Run all commands from the **repository root**.

### Option 1: Vite dev server (fast reload)

```sh
npm ci                                     # install all workspace dependencies
npm run start:dev --workspace @coffee/api  # terminal 1: API on :3000
npm run dev --workspace @coffee/web        # terminal 2: frontend on :5173
```

Open <http://localhost:5173>. Vite proxies every `/api` request to `http://localhost:3000`, so the API must be running.

### Option 2: Docker Compose (same setup as staging)

```sh
docker compose up --build
```

Open <http://localhost:8080>. This builds both images, starts the API first, and starts the web container only once the API's health check passes.

### Useful scripts

- `npm run dev --workspace @coffee/web` starts the Vite dev server.
- `npm run build --workspace @coffee/web` type-checks with `tsc -b` and builds the production bundle into `apps/web/dist/`.
- `npm run preview --workspace @coffee/web` serves the built bundle locally.
- `npm run lint` runs ESLint on the whole repo, including the React Hooks rules for `apps/web/src`.
- `npm run format` / `npm run format:check` run Prettier.

## The Docker image

[`Dockerfile.web`](../../Dockerfile.web) is a two-stage build, run from the repository root:

1. **Build stage** (`node:22-alpine`): copies the workspace `package.json` files and lockfile, runs `npm ci`, copies `apps/web`, and runs `npm run build --workspace @coffee/web`.
2. **Runtime stage** (`nginxinc/nginx-unprivileged:1.27-alpine`): copies `nginx.conf` and the built `dist/` folder. Nginx runs as a **non-root user** and listens on **port 8080**.

The image only contains static files and Nginx: no Node.js, no source code, and no secrets. A `HEALTHCHECK` requests `http://127.0.0.1:8080/` every 10 seconds.

[`nginx.conf`](./nginx.conf) does two things:

- `location /api/` proxies API calls to the `api` container on the Docker network and forwards the client's IP in `X-Real-IP` / `X-Forwarded-For`.
- `location /` serves the static files, falling back to `index.html` so client-side routes keep working after a page refresh.

## How it works in the Git repository (CI/CD)

The repository is hosted on GitHub and the pipelines run with **GitHub Actions**. There are two workflows in [`.github/workflows`](../../.github/workflows).

```text
git push
   |
   v
ci.yml  (Validate code)
   |-- npm ci
   |-- ESLint + Prettier check          <- checks apps/web/src
   |-- npm audit (production deps)      <- includes frontend dependencies
   |-- npm test                         <- API tests (no frontend tests yet)
   |-- npm run build                    <- type-checks and builds apps/web
   |-- Docker Compose smoke test        <- opens http://127.0.0.1:8080 and
   |                                       checks the page says "Coffee Corner",
   |                                       then calls /api through Nginx
   `-- Terraform fmt + validate
   |
   v   (only on the stage-backend branch: staging.yml)
test   -> runs tests, stores results on the staging server
build  -> builds Dockerfile.web, pushes <registry>/<web repo>:<commit sha> to Amazon ECR
deploy -> starts the new web + API containers on the staging EC2 server via AWS SSM
verify -> curl http://<staging IP>/ and http://<staging IP>/api/health
```

### Which branch runs what

- **`feature/**`**, **`main`** and **`stage-frontend`**: on push, `ci.yml` runs all the checks above. Nothing is deployed.
- **Pull requests to `main`, `stage-backend` or `stage-frontend`**: `ci.yml` runs.
- **`stage-backend`**: `staging.yml` runs the full CI, then builds and deploys **both** the web and API images to staging.
- **`stage-frontend`**: CI only. It doesn't deploy to staging yet (see below).

### On the staging server

On the staging EC2 server, the web container is started from [`deploy/docker-compose.staging.yml`](../../deploy/docker-compose.staging.yml):

- Host port **80** is mapped to container port **8080**, so the site is at `http://<staging IP>/`.
- It starts only after the API is healthy, restarts automatically, and is limited to 128 MB of memory.
- Logs are rotated (3 × 10 MB).
- Images are tagged with the commit SHA. If a new release fails its health check, the server switches back to the previous release automatically.

## Working on the frontend

1. Create a branch for your change, for example `feature/frontend-cart`, from `stage-frontend`.
2. Make your change in `apps/web/src`, and run the checks locally before pushing:

   ```sh
   npm run lint
   npm run format:check
   npm run build
   npm run test:compose   # needs Docker
   ```

3. Push the branch. `ci.yml` runs automatically because it matches `feature/**`.
4. Open a pull request into `stage-frontend` and merge it once the checks pass.

## Known gaps / next steps

- **No frontend tests yet.** `npm test` only runs the API tests. Next step: add Vitest and React Testing Library tests for loading, error, and ordering states.
- **`stage-frontend` doesn't deploy.** CI runs on it, but `staging.yml` only deploys `stage-backend`.
- **The AWS deploy role only trusts `stage-backend`.** Deploying from `stage-frontend` needs the OIDC trust policy in `infrastructure/terraform/environments/staging/main.tf` updated and applied.
- **The frontend and API are always deployed together.** A frontend-only change still rebuilds and redeploys the API image.
- **Staging uses plain HTTP**, with no domain or HTTPS.
