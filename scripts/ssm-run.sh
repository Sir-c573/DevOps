#!/usr/bin/env bash
# Runs a command on an EC2 instance through AWS SSM, after shipping a local
# directory to it. No S3 is involved: the directory is sent inside the SSM
# command itself (tar + gzip + base64), so keep it small (< ~40 KB packed).
#
#   scripts/ssm-run.sh <instance-id> <bundle-dir> <remote command...>
#
# On the server the bundle is extracted into a temporary directory, which is
# the working directory of the remote command. Exits non-zero if the remote
# command fails or doesn't finish within SSM_TIMEOUT seconds (default 600).
set -euo pipefail

INSTANCE="${1:?instance id}"
BUNDLE="${2:?bundle dir}"
shift 2
[ "$#" -gt 0 ] || {
  echo "usage: $0 <instance-id> <bundle-dir> <command...>" >&2
  exit 1
}

TIMEOUT="${SSM_TIMEOUT:-600}"
MAX_PAYLOAD=40000

PAYLOAD=$(tar -C "$BUNDLE" -czf - . | base64 -w0)
if [ "${#PAYLOAD}" -gt "$MAX_PAYLOAD" ]; then
  echo "Bundle is too large for SSM (${#PAYLOAD} bytes encoded)" >&2
  exit 1
fi

# Quote every argument so it reaches the remote shell unchanged.
REMOTE_COMMAND=$(printf '%q ' "$@")

SCRIPT=$(
  cat <<EOF
#!/bin/bash
set -euo pipefail
export HOME=/root
export AWS_DEFAULT_REGION=${AWS_REGION:?AWS_REGION must be set}
WORKDIR=\$(mktemp -d)
trap 'rm -rf "\$WORKDIR"' EXIT
echo '${PAYLOAD}' | base64 -d | tar -xz -C "\$WORKDIR"
cd "\$WORKDIR"
${REMOTE_COMMAND}
EOF
)

REQUEST="${RUNNER_TEMP:-/tmp}/ssm-command-$$.json"
trap 'rm -f "$REQUEST"' EXIT

jq -n \
  --arg instance "$INSTANCE" \
  --arg command "$SCRIPT" \
  --arg comment "${SSM_COMMENT:-GitHub Actions ${GITHUB_RUN_ID:-manual}}" \
  --arg timeout "$TIMEOUT" \
  '{
    InstanceIds: [$instance],
    DocumentName: "AWS-RunShellScript",
    Comment: ($comment | .[0:100]),
    Parameters: {
      commands: [$command],
      executionTimeout: [$timeout]
    }
  }' >"$REQUEST"

COMMAND_ID=$(aws ssm send-command \
  --cli-input-json "file://$REQUEST" \
  --query "Command.CommandId" \
  --output text)

echo "SSM command: $COMMAND_ID"

# `aws ssm wait` gives up after ~100s, which is too short for image pulls,
# so poll the command status ourselves.
STATUS=Pending
for _ in $(seq 1 $((TIMEOUT / 10 + 6))); do
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE" \
    --query Status --output text 2>/dev/null || echo Pending)

  case "$STATUS" in
    Success | Failed | Cancelled | TimedOut) break ;;
  esac
  sleep 10
done

aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE" \
  --query "{Stdout:StandardOutputContent,Stderr:StandardErrorContent}" \
  --output text || true

if [ "$STATUS" != "Success" ]; then
  echo "SSM command finished with status: $STATUS" >&2
  exit 1
fi
