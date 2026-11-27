
output "staging_instance_id" {
  value = module.ec2.instance_id
}

output "staging_public_ip" {
  value = module.ec2.public_ip
}

output "staging_url" {
  value = "http://${module.ec2.public_ip}"
}

output "static_files_bucket" {
  value = module.s3.bucket_name
}

output "staging_app_dir" {
  value = module.ec2.app_dir
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}
