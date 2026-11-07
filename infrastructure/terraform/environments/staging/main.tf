
locals {
  environment = "staging"
}

data "aws_caller_identity" "current" {}

# NETWORK MODULE

module "network" {
  source = "../../modules/network"

  environment        = local.environment
  project_name       = var.project_name
  vpc_cidr           = var.vpc_cidr
  public_subnet_cidr = var.public_subnet_cidr
  availability_zone  = var.availability_zone
}


# S3 MODULE

module "s3" {
  source = "../../modules/s3"

  environment = local.environment
  bucket_name = var.bucket_name
}


# ECR MODULE (container image repositories)

module "ecr" {
  source = "../../modules/ecr"

  repository_names = [
    "${var.project_name}-api",
    "${var.project_name}-web",
  ]
}


# EC2 IAM ROLE

resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-staging-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [{
      Effect = "Allow"

      Principal = {
        Service = "ec2.amazonaws.com"
      }

      Action = "sts:AssumeRole"
    }]
  })
}

# Allows EC2 to register with Systems Manager.

resource "aws_iam_role_policy_attachment" "ssm" {
  role = aws_iam_role.ec2_role.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Allows EC2 to download deployment configuration
# from the deployment folder in S3.

resource "aws_iam_role_policy" "ec2_s3" {
  name = "${var.project_name}-staging-s3-read"

  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [{
      Effect = "Allow"

      Action = [
        "s3:GetObject"
      ]

      Resource = "${module.s3.bucket_arn}/deploy/*"
    }]
  })
}

# Allows EC2 to pull images from ECR (read-only).

resource "aws_iam_role_policy_attachment" "ecr_read" {
  role = aws_iam_role.ec2_role.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_instance_profile" "staging" {
  name = "${var.project_name}-staging-profile"
  role = aws_iam_role.ec2_role.name
}


# EC2 MODULE


module "ec2" {
  source = "../../modules/ec2"

  project_name          = var.project_name
  environment           = local.environment
  instance_type         = var.instance_type
  subnet_id             = module.network.public_subnet_id
  security_group_id     = module.network.security_group_id
  instance_profile_name = aws_iam_instance_profile.staging.name

  depends_on = [
    aws_iam_role_policy_attachment.ssm,
    aws_iam_role_policy_attachment.ecr_read,
    aws_iam_role_policy.ec2_s3
  ]
}


# GITHUB OIDC PROVIDER


resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  # GitHub Actions OIDC certificate thumbprint.
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1"
  ]
}



# GITHUB ACTIONS IAM ROLE

resource "aws_iam_role" "github_actions" {
  name = "${var.project_name}-github-staging-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [{
      Effect = "Allow"

      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }

      Action = "sts:AssumeRoleWithWebIdentity"

      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:ref:refs/heads/stage"
        }
      }
    }]
  })
}


# GITHUB ACTIONS PERMISSIONS

resource "aws_iam_role_policy" "github_actions" {
  name = "${var.project_name}-github-staging-policy"

  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "s3:PutObject"
        ]

        Resource = [
          "${module.s3.bucket_arn}/staging/*",
          "${module.s3.bucket_arn}/deploy/*"
        ]
      },
      {
        # Run the deploy script on the staging instance only,
        # and only using the AWS-RunShellScript document.
        Effect = "Allow"

        Action = [
          "ssm:SendCommand"
        ]

        Resource = [
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${module.ec2.instance_id}",
          "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript"
        ]
      },
      {
        Effect = "Allow"

        Action = [
          "ssm:GetCommandInvocation",
          "ssm:ListCommandInvocations"
        ]

        Resource = "*"
      },
      {
        # Required by docker/login-action (amazon-ecr-login); cannot be scoped.
        Effect = "Allow"

        Action = [
          "ecr:GetAuthorizationToken"
        ]

        Resource = "*"
      },
      {
        # Push images to the project's repositories only.
        Effect = "Allow"

        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]

        Resource = values(module.ecr.repository_arns)
      }
    ]
  })
}
