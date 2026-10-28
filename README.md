# Coffee Corner

A small coffee shop app built with React and NestJS, intended for CI/CD and containerization practice. It has no database: the API saves orders to a JSON file.

## Stack

- React, TypeScript, and Vite frontend
- NestJS REST API
- Docker Compose with Nginx routing frontend requests to the API
- GitHub Actions CI for feature branches and `stage`, with production CD from `main`

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

## Branching and release workflow

- `stage` is the integration and testing branch. Do not develop directly on it.
- Create each feature branch from the latest `stage`, using a name such as `feature/frontend-menu` or `feature/backend-orders`.
- CI runs lint, formatting, API unit and integration tests, production builds, and the Docker Compose smoke test on pushes to `feature/**`, `stage`, and `main`. The same full checks run on pull requests into `stage` and `main`, including frontend-to-backend regression coverage.
- Open a pull request from the feature branch into `stage`. Merge after its checks pass, then let CI validate the combined `stage` branch.
- After testing the combined staging version, open a pull request from `stage` into `main`. Merge only after its required checks pass.
- On a successful feature-branch or `stage` push, CI automatically adds an immutable `tested-<branch>-<short-sha>` tag to that commit. Tags mark commits; they do not merge or move code between branches.
- On a successful push to `main`, CD builds and pushes both images to Amazon ECR, then deploys them to the EC2 instance through AWS Systems Manager. The API order file is kept in a Docker volume on the instance.

### Configure AWS deployment

Before merging a release to `main`, configure the following in GitHub repository **Settings → Secrets and variables → Actions**:

| Name                 | Type     | Value                                             |
| -------------------- | -------- | ------------------------------------------------- |
| `AWS_ROLE_ARN`       | Secret   | IAM role ARN trusted by GitHub Actions using OIDC |
| `AWS_REGION`         | Variable | AWS region containing ECR and the EC2 instance    |
| `ECR_API_REPOSITORY` | Variable | Existing ECR repository for the API image         |
| `ECR_WEB_REPOSITORY` | Variable | Existing ECR repository for the frontend image    |
| `EC2_INSTANCE_ID`    | Variable | EC2 instance managed by Systems Manager           |

The GitHub IAM role needs permission to push images to both ECR repositories and send/poll Systems Manager commands. Configure its OIDC trust policy to accept this repository's `main` branch only. The EC2 instance must be a Systems Manager managed instance, have Docker and the AWS CLI installed, and have an instance role with Systems Manager managed-instance permissions and ECR pull access. Allow inbound TCP port `8080` in its security group to access the deployed app at `http://<EC2-public-address>:8080`.

The workflow uses immutable commit-SHA image tags and deploys only after the full CI job succeeds on `main`. Add branch protection for `stage` and `main`, require the `validate` check, and require pull requests for `main`.
