
variable "project_name" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "subnet_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

variable "instance_profile_name" {
  type = string
}

variable "environment" {
  type        = string
  description = "Environment name, e.g. staging or production"
}

variable "availability_zone" {
  type        = string
  description = "Availability zone of the subnet; the data volume is created here"
}

variable "data_volume_size" {
  type        = number
  description = "Size in GiB of the EBS volume that stores releases, data, and test results"
  default     = 10
}
