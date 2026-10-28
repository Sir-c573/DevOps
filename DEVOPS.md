# DevOps workflow

This document explains how Coffee Corner is tested, promoted, tagged, and deployed. The automation is defined in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

## Application and deployment architecture

```text
Browser
  |
  | HTTP :8080
  v
EC2: Nginx frontend container
  |
  | /api requests on the private Docker network
  v
EC2: NestJS API container
  |
  | reads/writes JSON
  v
Docker volume: coffee-data
```

GitHub Actions builds separate frontend and API Docker images. Amazon ECR stores the images, and AWS Systems Manager (SSM) runs deployment commands on the EC2 instance. GitHub authenticates to AWS through OIDC; the workflow does not use long-lived AWS access keys.

## Branch and promotion flow

```text
latest stage
    |
    +-- feature/frontend-... or feature/backend-...
                |
                | CI passes; tested tag is added
                v
          pull request to stage
                |
                | combined application tests pass
                v
              stage
                |
                | staging sign-off; pull request to main
                v
              main
                |
                | CI passes, then CD deploys
                v
             EC2 live
```

Create each feature branch from the latest `stage` branch:

```sh
git switch stage
git pull origin stage
git switch -c feature/frontend-menu
```

After making changes, run checks locally and push the feature branch:

```sh
npm run lint
npm run format:check
npm test
npm run build
npm run test:compose
git push --set-upstream origin feature/frontend-menu
```

Open a pull request from the feature branch into `stage`. Merge after the required checks pass. Test the combined application on `stage`, then open a pull request from `stage` into `main`. Merging to `main` is the production release action.

Frontend and backend changes both run the same full test suite. In particular, API endpoint tests and the Docker Compose smoke test cover frontend-to-backend routing and order persistence, so backend changes receive regression coverage for the whole demo app.

## What CI checks

The `validate` job runs for:

- Pushes to `feature/**`, `stage`, and `main`
- Pull requests targeting `stage` or `main`

It performs these checks in order:

1. Installs the locked npm dependencies with `npm ci`.
2. Runs ESLint and checks Prettier formatting.
3. Runs API unit and HTTP integration tests.
4. Builds both the NestJS API and React frontend.
5. Builds and starts the Docker Compose app, checks its frontend and API, places orders, restarts the API, and checks that orders persist.
6. Removes the temporary smoke-test containers, network, and volume.

The full regression suite runs for frontend and backend changes alike.

## Tested commit tags

After `validate` succeeds on a push to a feature branch or `stage`, the `tag-tested` job adds an immutable tag to that exact commit:

```text
tested-feature-frontend-menu-<short-sha>
tested-stage-<short-sha>
```

Tags label commits; they do not merge branches or promote code. Pull-request runs do not create tags. Production Docker images use the full commit SHA as their image tag.

## Production CD on `main`

The `deploy-production` job runs only after `validate` succeeds for a push to `main`. It:

1. Authenticates to AWS through GitHub OIDC.
2. Builds the API and frontend Docker images.
3. Pushes both immutable, commit-SHA-tagged images to Amazon ECR.
4. Sends a deployment command to the configured EC2 instance through SSM.
5. Pulls the new images, recreates the containers, and checks the API health endpoint through Nginx.

The API stores orders in the `coffee-data` Docker volume on EC2. Recreating the API container preserves that volume. Removing the volume deletes the orders.

### GitHub settings required for AWS CD

In the repository’s **Settings → Secrets and variables → Actions**, configure:

| Name                 | Type     | Purpose                                      |
| -------------------- | -------- | -------------------------------------------- |
| `AWS_ROLE_ARN`       | Secret   | OIDC-trusted IAM role for the deployment job |
| `AWS_REGION`         | Variable | Region containing ECR and EC2                |
| `ECR_API_REPOSITORY` | Variable | Existing ECR repository for the API          |
| `ECR_WEB_REPOSITORY` | Variable | Existing ECR repository for the frontend     |
| `EC2_INSTANCE_ID`    | Variable | EC2 instance managed by SSM                  |

The GitHub IAM role needs ECR image push permissions and permission to send SSM commands and retrieve their status. Restrict its OIDC trust policy to this repository’s `main` branch.

The EC2 instance needs Docker, the AWS CLI, a working SSM Agent connection, and an instance role that permits SSM management and ECR image pulls. Allow inbound TCP port `8080` in the instance security group to access the app at `http://<EC2-public-address>:8080`.

**CD is not ready to deploy until these AWS resources and GitHub settings exist.** The CI workflow can run without them; the production deploy job will fail if the required settings or instance are missing.

## Protecting the promotion flow

CI reports whether checks pass, but GitHub branch protection must be enabled separately to prevent bypassing the checks. Protect `stage` and `main`, require the `validate` status check before merging, and require pull requests for `main`. Consider requiring pull requests for `stage` as well, so feature work is reviewed before integration.

## Current limitations

- The deployment replaces the running containers and is not a zero-downtime rollout; automatic rollback is not configured.
- The JSON order file is suitable for this single-instance learning project, not concurrent/multi-instance production traffic.
- The live URL uses HTTP on port `8080`; a real public service should add HTTPS and a domain.
- Staging runs the full CI checks but is not automatically deployed to a separate staging server.
