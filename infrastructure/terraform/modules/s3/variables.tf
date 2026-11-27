
variable "bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for static files"
}

variable "environment" {
  type        = string
  description = "Environment name, e.g. staging or production"
}
