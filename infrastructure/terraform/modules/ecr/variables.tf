variable "repository_names" {
  type        = list(string)
  description = "ECR repository names to create"
}

variable "max_image_count" {
  type        = number
  description = "Number of images to keep per repository"
  default     = 30
}
