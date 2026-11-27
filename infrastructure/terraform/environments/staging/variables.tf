
variable "aws_region" {
  type        = string
  description = "AWS region for staging"
}

variable "project_name" {
  type        = string
  description = "Project identifier"
}

variable "vpc_cidr" {
  type        = string
  description = "Staging VPC CIDR"
}

variable "public_subnet_cidr" {
  type        = string
  description = "Staging public subnet CIDR"
}

variable "availability_zone" {
  type        = string
  description = "Availability zone for staging"
}

variable "instance_type" {
  type        = string
  description = "Staging EC2 instance type"
}

variable "bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for static files"
}

variable "github_repository" {
  type        = string
  description = "GitHub repository in owner/repository format"
}

variable "github_oidc_repository" {
  type        = string
  description = "Repository as written in the GitHub OIDC sub claim, e.g. owner@ID/repo@ID"
}
variable "data_volume_size" {
  type        = number
  description = "Size in GiB of the staging data volume (releases, data, test results)"
  default     = 10
}
