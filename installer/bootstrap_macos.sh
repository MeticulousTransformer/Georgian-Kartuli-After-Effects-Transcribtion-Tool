#!/bin/bash
# macOS has curl, plutil and shasum already. No installed Python or package manager needed.
set -euo pipefail
installer_dir="$(cd "$(dirname "$0")" && pwd)"
manifest="$installer_dir/runtime_assets.json"
root="$HOME/Library/Application Support/CapForge"
legacy="$HOME/Library/Application Support/Kartuli Caption Forge"

owned() {
  [ -f "$1/.kcf-install.json" ] || return 1
  local tool
  tool=$(/usr/bin/plutil -extract tool raw -o - "$1/.kcf-install.json" 2>/dev/null) || return 1
  [ "$tool" = 'CapForge' ] || [ "$tool" = 'Kartuli Caption Forge' ]
}
no_links() {
  local cursor="$1"
  while [ "$cursor" != '/' ] && [ -n "$cursor" ]; do
    [ ! -L "$cursor" ] || { echo 'Choose an installation folder without symbolic links.'; exit 1; }
    cursor="$(dirname "$cursor")"
  done
}
fail() {
  /usr/bin/osascript -e 'display alert "CapForge setup could not finish" message "Check your internet connection and open Install macOS.command again. Your saved keys and exports are preserved." as critical' || true
}
trap fail ERR
if owned "$legacy"; then root="$legacy"; fi
no_links "$root"
if [ -d "$root" ] && [ -n "$(ls -A "$root")" ] && ! owned "$root"; then
  echo 'The CapForge folder contains unrelated files. Move it aside or use a custom installation destination.'
  exit 1
fi
mkdir -p "$root"
if ! owned "$root"; then
  printf '{}\n' > "$root/.kcf-install.json"
  /usr/bin/plutil -insert tool -string 'CapForge' "$root/.kcf-install.json"
  /usr/bin/plutil -insert version -string '0.3.0' "$root/.kcf-install.json"
  /usr/bin/plutil -insert runtimeRoot -string "$root" "$root/.kcf-install.json"
fi
case "$(uname -m)" in
  arm64) asset='mac_arm64'; triplet='aarch64-apple-darwin' ;;
  x86_64) asset='mac_x64'; triplet='x86_64-apple-darwin' ;;
  *) echo 'CapForge supports Apple Silicon and Intel Macs.'; exit 1 ;;
esac
version=$(/usr/bin/plutil -extract version raw -o - "$manifest")
python_version=$(/usr/bin/plutil -extract python raw -o - "$manifest")
url=$(/usr/bin/plutil -extract "assets.$asset.url" raw -o - "$manifest")
checksum=$(/usr/bin/plutil -extract "assets.$asset.sha256" raw -o - "$manifest")
case "$url" in https://github.com/astral-sh/uv/releases/download/*) ;; *) echo 'Invalid setup manifest.'; exit 1 ;; esac
private="$root/.runtime"
uv_dir="$private/uv/$version"
uv="$uv_dir/uv"
no_links "$uv"
if [ ! -x "$uv" ]; then
  echo 'Preparing CapForge setup tools…'
  mkdir -p "$private"
  stage=$(/usr/bin/mktemp -d "$private/.download-XXXXXX")
  archive="$stage/runtime.tar.gz"
  /usr/bin/curl --fail --location --proto '=https' --tlsv1.2 --retry 2 --output "$archive" "$url"
  actual=$(/usr/bin/shasum -a 256 "$archive")
  if [ "${actual%% *}" != "$checksum" ]; then echo 'Setup download verification failed. Please retry.'; exit 1; fi
  # The archive is pinned and verified; extract only the one executable we use.
  /usr/bin/tar -xzf "$archive" -C "$stage" "uv-$triplet/uv"
  mkdir -p "$uv_dir"
  /bin/cp "$stage/uv-$triplet/uv" "$uv"
  /bin/chmod 755 "$uv"
  # Keep verified download files; no recursive deletion of computed paths.
fi
export UV_PYTHON_INSTALL_DIR="$private/python"
export UV_CACHE_DIR="$private/cache"
export UV_PYTHON_INSTALL_BIN=0
export UV_PYTHON_INSTALL_REGISTRY=0
echo 'Preparing the private CapForge runtime…'
"$uv" python install "$python_version" --no-bin --no-registry --managed-python --no-config
python_path=$("$uv" python find "$python_version" --managed-python --no-config)
case "$python_path" in "$root/"*) ;; *) echo 'Runtime location could not be verified.'; exit 1 ;; esac
"$python_path" -I -c 'import tkinter, venv, ssl; tkinter.Tcl().eval("info patchlevel")'
echo 'Opening CapForge Setup…'
exec "$python_path" "$installer_dir/install.py" --target "$root"
