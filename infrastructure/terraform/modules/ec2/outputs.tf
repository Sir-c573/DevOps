
output "instance_id" {
  value = aws_instance.this.id
}

# The Elastic IP: stays the same across instance stop/start and replacement.
output "public_ip" {
  value = aws_eip.this.public_ip
}

output "public_dns" {
  value = aws_eip.this.public_dns
}

output "app_dir" {
  value = local.app_dir
}

output "data_volume_id" {
  value = aws_ebs_volume.data.id
}
