
variable "bucket_name" {
  type        = string
  description = "Globally unique s3 bucket name"
}

variable "environment" {
  type        = string
  description = "Environment name, e.g. staging or production"
}
