
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name = "name"

    values = [
      "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"
    ]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

locals {
  app_dir = "/opt/devops-${var.environment}"
}

# DATA VOLUME
# Everything the environment keeps on the server lives here: release history
# (compose file + image references), application data, and test results.
# It is a separate EBS volume, so it survives instance replacement.

resource "aws_ebs_volume" "data" {
  availability_zone = var.availability_zone
  size              = var.data_volume_size
  type              = "gp3"
  encrypted         = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-data"
    Environment = var.environment
  }
}

resource "aws_instance" "this" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]

  iam_instance_profile = var.instance_profile_name

  associate_public_ip_address = true

  user_data = <<-EOF
    #!/bin/bash
    set -eux

    APP_DIR="${local.app_dir}"

    apt-get update
    apt-get install -y docker.io docker-compose-v2 curl unzip jq

    # "awscli" is not available as an apt package on Ubuntu 24.04,
    # so install AWS CLI v2 from the official bundle.
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install
    rm -rf /tmp/aws /tmp/awscliv2.zip

    # 1 GiB swap: small instances run out of memory during image pulls.
    if [ ! -f /swapfile ]; then
      fallocate -l 1G /swapfile
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi

    systemctl enable docker
    systemctl start docker

    # Mount the data volume. On Nitro instances it shows up as an NVMe device
    # whose by-id name contains the volume ID (without the dash). Terraform
    # attaches it after the instance starts, so wait for it.
    DEVICE="/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_${replace(aws_ebs_volume.data.id, "-", "")}"
    for _ in $(seq 1 60); do
      [ -e "$DEVICE" ] && break
      sleep 5
    done
    [ -e "$DEVICE" ]

    # Format only if the volume is empty, so existing data is kept.
    if ! blkid "$DEVICE"; then
      mkfs.ext4 -L appdata "$DEVICE"
    fi

    mkdir -p "$APP_DIR"
    UUID=$(blkid -s UUID -o value "$DEVICE")
    grep -q "$UUID" /etc/fstab || echo "UUID=$UUID $APP_DIR ext4 defaults,nofail 0 2" >> /etc/fstab
    mount -a

    mkdir -p "$APP_DIR/releases" "$APP_DIR/test-results" "$APP_DIR/data"
    chmod 755 "$APP_DIR"
    # The API container runs as the "node" user (UID 1000).
    chown 1000:1000 "$APP_DIR/data"
  EOF

  user_data_replace_on_change = true

  # Require IMDSv2 (protects against SSRF stealing instance credentials).
  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-server"
    Environment = var.environment
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.this.id

  # Stop the instance before detaching so the filesystem is unmounted cleanly
  # when the instance is replaced.
  stop_instance_before_detaching = true
}

# ELASTIC IP
# A fixed public IP, so the address doesn't change when the instance is
# stopped, started, or replaced.

resource "aws_eip" "this" {
  domain = "vpc"

  tags = {
    Name        = "${var.project_name}-${var.environment}-eip"
    Environment = var.environment
  }
}

resource "aws_eip_association" "this" {
  instance_id   = aws_instance.this.id
  allocation_id = aws_eip.this.id
}

moved {
  from = aws_instance.staging
  to   = aws_instance.this
}
