
output "instance_id" {
  value = aws_instance.staging.id
}

output "public_ip" {
  value = aws_instance.staging.public_ip
}

output "public_dns" {
  value = aws_instance.staging.public_dns
}
