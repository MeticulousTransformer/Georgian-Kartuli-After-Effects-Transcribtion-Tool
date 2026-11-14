#!/bin/bash
# GitHub-hosted macOS runner only. Credentials arrive through step-scoped secrets.
set -euo pipefail

names=(CAPFORGE_APPLE_CERTIFICATE_P12 CAPFORGE_APPLE_CERTIFICATE_PASSWORD CAPFORGE_APPLE_ID CAPFORGE_APPLE_APP_PASSWORD CAPFORGE_APPLE_TEAM_ID)
present=0
missing=()
for name in "${names[@]}"; do
    if [[ -n "${!name:-}" ]]; then
        present=$((present + 1))
    else
        missing+=("$name")
    fi
done
if [[ "$present" == 0 ]]; then
    echo "configured=false" >> "$GITHUB_OUTPUT"
    echo "::notice::Apple credentials are not configured. Build preview artifacts only; public release is disabled. See docs/MAC_SIGNING.md."
    exit 0
fi
if [[ "$present" != "${#names[@]}" ]]; then
    echo "::error::Incomplete Apple configuration. Missing secrets: ${missing[*]}"
    exit 1
fi

umask 077
certificate="$RUNNER_TEMP/capforge-certificate.p12"
keychain="$RUNNER_TEMP/capforge-signing.keychain-db"
trap 'rm -f "$certificate"' EXIT
keychain_password=$(openssl rand -hex 32)
echo "::add-mask::$keychain_password"
export CAPFORGE_CERTIFICATE_PATH="$certificate"
python - <<'PY'
import base64
import os
from pathlib import Path
Path(os.environ['CAPFORGE_CERTIFICATE_PATH']).write_bytes(
    base64.b64decode(''.join(os.environ['CAPFORGE_APPLE_CERTIFICATE_P12'].split()), validate=True))
PY
security create-keychain -p "$keychain_password" "$keychain"
security set-keychain-settings -lut 7200 "$keychain"
security unlock-keychain -p "$keychain_password" "$keychain"
security import "$certificate" -k "$keychain" -P "$CAPFORGE_APPLE_CERTIFICATE_PASSWORD" -f pkcs12 -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple: -s -k "$keychain_password" "$keychain" >/dev/null

# Use the fingerprint, not a guessed display name, and require the requested team.
export CAPFORGE_SIGNING_KEYCHAIN="$keychain"
identity=$(python - <<'PY'
import os
import re
import subprocess
team = os.environ['CAPFORGE_APPLE_TEAM_ID']
if not re.fullmatch(r'[A-Z0-9]{10}', team):
    raise SystemExit('Invalid Apple Team ID: expected 10 uppercase letters/digits.')
result = subprocess.run(['security', 'find-identity', '-v', '-p', 'codesigning',
                         os.environ['CAPFORGE_SIGNING_KEYCHAIN']],
                        check=True, text=True, capture_output=True)
identities = re.findall(r'\b([A-Fa-f0-9]{40}) "Developer ID Application: [^"\n]+ \('
                        + re.escape(team) + r'\)"', result.stdout)
if len(identities) != 1:
    raise SystemExit('The P12 must contain exactly one valid Developer ID Application identity for the configured team, including its private key.')
print(identities[0])
PY
)
xcrun notarytool store-credentials CapForgeNotary --apple-id "$CAPFORGE_APPLE_ID" --team-id "$CAPFORGE_APPLE_TEAM_ID" --password "$CAPFORGE_APPLE_APP_PASSWORD" --keychain "$keychain" --validate
echo "CAPFORGE_MACOS_SIGNING_IDENTITY=$identity" >> "$GITHUB_ENV"
echo "CAPFORGE_SIGNING_KEYCHAIN=$keychain" >> "$GITHUB_ENV"
echo "configured=true" >> "$GITHUB_OUTPUT"
