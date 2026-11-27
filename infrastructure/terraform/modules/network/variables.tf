
variable "project_name" {
  type        = string
  description = "Project name"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block"
}

variable "public_subnet_cidr" {
  type        = string
  description = "Public subnet CIDR block"
}

variable "availability_zone" {
  type        = string
  description = "AWS availability zone"
}

variable "environment" {
  type        = string
  description = "Environment name, e.g. staging or production"
}
