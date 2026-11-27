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
Docker volume: coffee-data
```

GitHub Actions builds separate frontend and API Docker images. Amazon ECR stores the images, and AWS Systems Manager (SSM) runs deployment commands on the EC2 instance. GitHub authenticates to AWS through OIDC, so the workflows don't use long-lived AWS access keys.

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
2. Runs ESLint and checks Prettier formatting.
3. Runs `npm audit` for high or critical vulnerabilities in production dependencies.
4. Runs API unit and HTTP integration tests.
5. Builds both the NestJS API and React frontend.
6. Builds and starts the Docker Compose app, checks the frontend and API, places orders, restarts the API, and checks that orders persist. It then removes the temporary containers, network, and volume.
7. Checks Terraform formatting and runs `terraform validate` for the staging environment.

## Staging CI/CD on `stage-backend`

`staging.yml` runs on every push to `stage-backend`, and you can also start it manually (`workflow_dispatch`). Only one staging deployment runs at a time. The jobs are:

1. **`ci`**: calls `ci.yml`. If any check fails, nothing is deployed.
2. **`test`**: authenticates to AWS through OIDC, runs `npm test`, and uploads the test log and build info to `s3://<results bucket>/staging/<run id>-<attempt>/`.
3. **`build`**: builds the API and web images and pushes them to ECR, tagged with the full commit SHA. The tags are immutable.
4. **`deploy`**:
   - Uploads `deploy/docker-compose.staging.yml` and a generated `.env` (holding the image references) to `s3://<results bucket>/deploy/staging/`.
   - Sends an SSM `AWS-RunShellScript` command to the staging instance. The command downloads both files, logs in to ECR, runs `docker compose pull` and `up -d`, and prunes old images.
   - Polls the SSM command for up to 10 minutes.
   - Checks `http://<staging IP>/` and `http://<staging IP>/api/health`.

The API stores orders in the `coffee-data` Docker volume on EC2. Recreating the API container preserves that volume; removing the volume deletes the orders.

### GitHub settings required

In the repository's **Settings → Secrets and variables → Actions**, configure:

| Name                     | Type     | Purpose                                                            |
| ------------------------ | -------- | ------------------------------------------------------------------ |
| `AWS_ROLE_ARN`           | Secret   | OIDC-trusted IAM role (Terraform output `github_actions_role_arn`) |
| `AWS_REGION`             | Variable | Region containing ECR, S3, and EC2                                 |
| `STAGING_RESULTS_BUCKET` | Variable | S3 bucket for test results and deploy files (`results_bucket`)     |
| `ECR_API_REPOSITORY`     | Variable | ECR repository name for the API (`<project_name>-api`)             |
| `ECR_WEB_REPOSITORY`     | Variable | ECR repository name for the web app (`<project_name>-web`)         |
| `STAGING_INSTANCE_ID`    | Variable | Staging EC2 instance ID (`staging_instance_id`)                    |
| `STAGING_PUBLIC_IP`      | Variable | Staging EC2 public IP (`staging_public_ip`)                        |

## Infrastructure (Terraform)

`infrastructure/terraform/environments/staging` creates:

- A VPC, a public subnet, an internet gateway, and a security group that allows inbound HTTP on port 80.
- The S3 results bucket: versioned, encrypted, public access blocked, with `staging/` reports expiring after 365 days.
- ECR repositories for the API and web images: immutable tags, scan on push, keeping the last 30 images.
- The staging EC2 instance: Ubuntu 24.04 with Docker, Docker Compose, and AWS CLI v2. IMDSv2 is required and the root volume is encrypted.
- An instance role allowing SSM management, ECR pulls, and reads from `deploy/*` in the bucket.
- The GitHub OIDC provider, and a GitHub Actions role with a narrow set of permissions:
  - Write to `staging/*` and `deploy/*` in the bucket.
  - Run `AWS-RunShellScript` on the staging instance only.
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
- The deployment replaces the running containers, so it isn't a zero-downtime rollout, and automatic rollback isn't configured. To roll back, redeploy an earlier commit SHA.
- Terraform state is stored locally. A shared remote backend isn't configured.
- The instance has no Elastic IP, so its public IP (and `STAGING_PUBLIC_IP`) changes if the instance is stopped and started.
- Staging is served over plain HTTP on port 80, with no domain or HTTPS.
- The JSON order file suits this single-instance learning project. It can't handle concurrent or multi-instance production traffic.
