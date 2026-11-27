# DevOps workflow

This document explains how Coffee Corner is tested and deployed to staging. The automation is defined in two workflows:

- [`.github/workflows/ci.yml`](./.github/workflows/ci.yml): the CI checks (`validate` job).
- [`.github/workflows/staging.yml`](./.github/workflows/staging.yml): staging CI/CD. It runs `ci.yml` first, then tests, builds, pushes, and deploys.

Infrastructure is defined with Terraform in [`infrastructure/terraform`](./infrastructure/terraform).

## Application and deployment architecture

```text
Browser
  |
  | HTTP :80 (host) -> :8080 (container)
  v
EC2: Nginx frontend container
  |
  | /api requests on the private Docker network
  v
EC2: NestJS API container
  |
  | reads/writes JSON
  v
EBS data volume: /opt/devops-staging/data/orders.json
```

GitHub Actions builds separate frontend and API Docker images and pushes them to Amazon ECR. AWS Systems Manager (SSM) sends the deployment files and test results straight to the EC2 server, which keeps them on its EBS data volume. S3 isn't used by CI/CD; the bucket is kept for static files only. GitHub authenticates to AWS through OIDC, so the workflows don't use long-lived AWS access keys.

### What the staging server stores

Everything lives on a separate EBS volume mounted at `/opt/devops-staging`, so it survives instance replacement:

| Path                               | Contents                                                           |
| ---------------------------------- | ------------------------------------------------------------------ |
| `releases/<commit sha>/`           | `docker-compose.yml` and `.env` (image references) of each release |
| `current`                          | Symlink to the live release                                        |
| `data/`                            | API data (`orders.json`), bind-mounted into the API container      |
| `test-results/<run id>-<attempt>/` | `test.log` and `build-info.txt` from every staging pipeline run    |

The Docker images of the last 5 releases stay on the server (older ones are removed together with their release folder), and the last 50 test results are kept. Container logs are rotated (3 × 10 MB per container).

## Branches

| Branch                           | What runs                                                          |
| -------------------------------- | ------------------------------------------------------------------ |
| `feature/**`                     | CI (`ci.yml`) on push                                              |
| `stage-backend`                  | Staging CI/CD (`staging.yml`): full CI, then deploy to staging EC2 |
| `main`                           | CI on push                                                         |
| PRs to `main` or `stage-backend` | CI                                                                 |

Before pushing, run the same checks locally (Node.js 22 is required):

```sh
npm run lint
npm run format:check
npm test
npm run build
npm run test:compose
```

## What CI checks

The `validate` job in `ci.yml` runs, in order:

1. Installs the locked npm dependencies with `npm ci`.
2. Runs ESLint, checks Prettier formatting, lints the shell scripts with ShellCheck, and validates the staging Compose file.
3. Runs `npm audit` for high or critical vulnerabilities in production dependencies.
4. Runs API unit and HTTP integration tests.
5. Builds both the NestJS API and React frontend.
6. Builds and starts the Docker Compose app, checks the frontend and API, places orders, restarts the API, and checks that orders persist. It then removes the temporary containers, network, and volume.
7. Checks Terraform formatting and runs `terraform validate` for the staging environment.

## Staging CI/CD on `stage-backend`

`staging.yml` runs on every push to `stage-backend`, and you can also start it manually (`workflow_dispatch`). Only one staging deployment runs at a time. The jobs are:

1. **`ci`**: calls `ci.yml`. If any check fails, nothing is deployed.
2. **`test`**: authenticates to AWS through OIDC, runs `npm test`, and stores the test log and build info on the staging server in `test-results/<run id>-<attempt>/`. The same files are also attached to the workflow run as an artifact (kept 14 days).
3. **`build`**: builds the API and web images and pushes them to ECR, tagged with the full commit SHA. The tags are immutable.
4. **`deploy`**:
   - Bundles `deploy/docker-compose.staging.yml`, `deploy/server.sh`, and a generated `.env` (registry and image references).
   - `scripts/ssm-run.sh` sends the bundle inside an SSM `AWS-RunShellScript` command (no S3) and waits up to 15 minutes.
   - On the server, `server.sh deploy <sha>` saves the release under `releases/<sha>/`, logs in to ECR, pulls the images, and starts them with `docker compose up --wait`. If the new release doesn't become healthy, it switches back to the previous release and the job fails.
   - Checks `http://<staging IP>/` and `http://<staging IP>/api/health`.

### Rolling back

The last 5 releases are kept on the server with their images. To switch back without rebuilding, open a shell on the server and run the helper that every deploy installs:

```sh
aws ssm start-session --target <staging instance id>
sudo coffee-server status              # list kept releases
sudo coffee-server rollback <commit sha>
```

### GitHub settings required

In the repository's **Settings → Secrets and variables → Actions**, configure:

| Name                  | Type     | Purpose                                                            |
| --------------------- | -------- | ------------------------------------------------------------------ |
| `AWS_ROLE_ARN`        | Secret   | OIDC-trusted IAM role (Terraform output `github_actions_role_arn`) |
| `AWS_REGION`          | Variable | Region containing ECR and EC2                                      |
| `ECR_API_REPOSITORY`  | Variable | ECR repository name for the API (`<project_name>-api`)             |
| `ECR_WEB_REPOSITORY`  | Variable | ECR repository name for the web app (`<project_name>-web`)         |
| `STAGING_INSTANCE_ID` | Variable | Staging EC2 instance ID (`staging_instance_id`)                    |
| `STAGING_PUBLIC_IP`   | Variable | Staging Elastic IP (`staging_public_ip`)                           |

## Infrastructure (Terraform)

`infrastructure/terraform/environments/staging` creates:

- A VPC, a public subnet, an internet gateway, and a security group that allows inbound HTTP on port 80.
- An S3 bucket for static files only: versioned, encrypted, public access blocked, old versions expire after 30 days. CI/CD doesn't use it.
- ECR repositories for the API and web images: immutable tags, scan on push, keeping the last 30 images.
- The staging EC2 instance: Ubuntu 24.04 with Docker, Docker Compose, AWS CLI v2, and 1 GiB of swap. IMDSv2 is required and the root volume is encrypted.
- A separate encrypted EBS data volume (`data_volume_size`, default 10 GiB) mounted at `/opt/devops-staging`.
- An Elastic IP, so the public IP stays the same when the instance is stopped, started, or replaced.
- An instance role allowing SSM management and ECR pulls.
- The GitHub OIDC provider, and a GitHub Actions role with a narrow set of permissions:
  - Run `AWS-RunShellScript` on the staging instance only (deploys and test results).
  - Push images to the project's ECR repositories only.

The role's trust policy only accepts tokens from the `stage-backend` branch. The repository uses GitHub's ID-based OIDC subject format (`repo:owner@ID/repo@ID:ref:refs/heads/stage-backend`), which is set with `github_oidc_repository`.

To apply:

```sh
cd infrastructure/terraform/environments/staging
cp terraform.tfvars.example terraform.tfvars   # then edit
terraform init
terraform apply
```

## Protecting the branches

CI reports whether checks pass, but merges can still bypass it until you turn on GitHub branch protection. Protect `main` and `stage-backend`, require pull requests, and require the `validate` status check before merging.

## Current limitations

- There's no production (live) environment or production approval gate yet. Only staging is deployed.
- The deployment replaces the running containers, so it isn't a zero-downtime rollout. A release that fails its health check is rolled back automatically; see [Rolling back](#rolling-back) for manual rollbacks.
- Terraform state is stored locally. A shared remote backend isn't configured, so keep `terraform.tfstate` safe and run Terraform from one place.
- Staging is served over plain HTTP on port 80, with no domain or HTTPS.
- The JSON order file suits this single-instance learning project. It can't handle concurrent or multi-instance production traffic.
