# Coffee Corner

A small coffee shop app built with React and NestJS, intended for CI/CD and containerization practice. It has no database: the API saves orders to a JSON file.

## Stack

- React, TypeScript, and Vite frontend
- NestJS REST API
- Docker Compose with Nginx routing frontend requests to the API
- GitHub Actions lint, format, test, build, and Docker smoke-test workflow

## Run locally

Requirements: Node.js 20+ and npm.

```sh
npm ci
npm run dev --workspace @coffee/web
npm run start:dev --workspace @coffee/api
```

Open the Vite URL printed in the terminal (usually http://localhost:5173). The frontend proxies `/api` requests to `http://localhost:3000`.

## Run with Docker

Requirements: Docker with the Compose plugin.

```sh
docker compose up --build
```

Open http://localhost:8080. The API is also available through the frontend container at `/api`.
Orders persist in a Docker volume across API restarts and container rebuilds. To remove the saved orders as well as stop the app, run `docker compose down --volumes`.

```sh
docker compose down
```

## API

| Method | Path          | Description                                                                    |
| ------ | ------------- | ------------------------------------------------------------------------------ |
| `GET`  | `/api/health` | Container health check                                                         |
| `GET`  | `/api/menu`   | List available drinks                                                          |
| `POST` | `/api/orders` | Place an order saved to `data/orders.json`; JSON body: `{"itemId":"espresso"}` |

## Validate

```sh
npm ci
npm run lint
npm run format:check
npm test
npm run build
npm run test:compose
```

The Compose smoke test builds and starts the app, checks the frontend and API, places orders, and confirms orders survive an API restart. It uses a separate temporary Compose project and removes its test volume afterward.

The CI workflow runs all checks on pushes and pull requests to `main`.
