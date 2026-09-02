#!/usr/bin/env bash
# Personal OS bootstrap — PC (Ubuntu inside WSL2).
# Run INSIDE Ubuntu, after the UNIX user exists, as that user:
#   curl -fsSL https://personal-os-starter.vercel.app/pc.sh | bash
# Everything up to "claude is authenticated" happens here. Idempotent — safe to re-run.
set -uo pipefail
KIT_REPO="https://github.com/bryanstealey/personal-os-starter.git"
KIT_DIR="$HOME/personal-os-installer"
NVM_VER="v0.40.7"
say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mSTOP: %s\033[0m\n' "$*"; exit 1; }

main() {

[ "$(id -u)" -eq 0 ] && die "Run this as your normal Ubuntu user, not root."
grep -qi microsoft /proc/version 2>/dev/null || warn "This doesn't look like WSL. Continuing anyway."

say "1/7  System packages  (sudo password = the Ubuntu password you just created)"
sudo apt-get update -y >/dev/null || die "apt update failed. Cert errors = corporate TLS inspection; try a phone hotspot for the download steps."
sudo apt-get install -y jq git curl ca-certificates build-essential python3 python-is-python3 >/dev/null || die "apt install failed."
echo "ok: jq git curl python3 build tools"

say "2/7  Node via nvm"
if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
  curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VER/install.sh" | bash >/dev/null || die "nvm install failed."
fi
export NVM_DIR="$HOME/.nvm"
set +u   # nvm.sh is not set -u safe
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install --lts >/dev/null 2>&1 || die "Node install failed."
set -u
mkdir -p "$HOME/.local/bin"
for b in node npm npx; do ln -sf "$(command -v "$b")" "$HOME/.local/bin/$b"; done
echo "ok: node $(node --version)"

say "3/7  PATH  (written to BOTH .bashrc and .profile)"
LINE='export PATH="$HOME/.local/bin:$PATH"'
for rc in "$HOME/.bashrc" "$HOME/.profile"; do
  touch "$rc"; grep -qF "$LINE" "$rc" || echo "$LINE" >> "$rc"
done
export PATH="$HOME/.local/bin:$PATH"
echo "ok"

say "4/7  Claude Code  (native installer)"
curl -fsSL https://claude.ai/install.sh | bash >/dev/null || die "Claude Code install failed."
command -v claude >/dev/null || die "claude is not on PATH after install."
echo "ok: claude $(claude --version 2>/dev/null | head -1)"

say "5/7  WSL memory cap  (.wslconfig on the Windows side)"
WINHOME="$(cd /mnt/c 2>/dev/null && wslpath -u "$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null </dev/null | tr -d '\r')" 2>/dev/null || true)"
if [ -n "$WINHOME" ] && [ -d "$WINHOME" ]; then
  BYTES="$(cd /mnt/c && powershell.exe -NoProfile -Command '(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory' 2>/dev/null </dev/null | tr -d '\r ' || true)"
  case "$BYTES" in ''|*[!0-9]*) BYTES=0;; esac
  GB=$(( BYTES / 1073741824 ))
  MEM=5; [ "$GB" -ge 30 ] && MEM=8; [ "$GB" -gt 0 ] && [ "$GB" -le 8 ] && MEM=3
  CORES=$(( $(nproc 2>/dev/null || echo 4) / 2 )); [ "$CORES" -lt 2 ] && CORES=2
  if [ -f "$WINHOME/.wslconfig" ]; then
    echo "already exists: $WINHOME/.wslconfig (left alone)"
  else
    printf '[wsl2]\nmemory=%sGB\nprocessors=%s\n\n[experimental]\nautoMemoryReclaim=gradual\n' "$MEM" "$CORES" > "$WINHOME/.wslconfig" \
      && echo "wrote $WINHOME/.wslconfig  (memory=${MEM}GB on a ${GB}GB machine) — takes effect after the reboot below" \
      || warn "could not write .wslconfig — do it by hand (WINDOWS-SETUP.md, hardening fix #1)"
  fi
else
  warn "Couldn't find the Windows home folder — write .wslconfig by hand (WINDOWS-SETUP.md, hardening fix #1)."
fi

say "6/7  The kit + your config"
if [ -d "$KIT_DIR/.git" ]; then
  git -C "$KIT_DIR" pull -q --ff-only || warn "kit pull failed; using the existing copy"
elif [ -e "$KIT_DIR" ]; then
  die "$KIT_DIR exists but is not a git checkout (interrupted earlier?). Run:  mv $KIT_DIR $KIT_DIR.old   then re-run this script."
else
  git clone -q "$KIT_REPO" "$KIT_DIR" || die "Could not clone the kit."
fi
CFG=""
for d in "$WINHOME/OneDrive/Downloads" "$WINHOME/Downloads" "$WINHOME"/OneDrive*/Downloads "$HOME/Downloads"; do
  [ -f "$d/user-config.json" ] && { CFG="$d/user-config.json"; break; }
done
CONFIG_OK=0
if [ -n "$CFG" ]; then
  cp "$CFG" "$KIT_DIR/config/user-config.json" && echo "config copied from: $CFG" && CONFIG_OK=1
else
  warn "user-config.json not found in Windows Downloads."
fi

say "7/7  Windows apps: Git for Windows + Obsidian  — watch Windows for UAC prompts"
if (cd /mnt/c && command -v winget.exe >/dev/null 2>&1); then
  GITEXE="/mnt/c/Program Files/Git/cmd/git.exe"
  if [ -x "$GITEXE" ]; then
    echo "ok: Git for Windows already present"
  elif (cd /mnt/c && winget.exe install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements >/dev/null 2>&1 </dev/null); then
    echo "ok: Git for Windows installed"
  else
    warn "winget could not install Git for Windows. In PowerShell:  winget install --id Git.Git -e"
    warn "then:  git config --global core.autocrlf false   — or drop obsidian-git from the vault's .obsidian/community-plugins.json for week one."
  fi
  if [ -x "$GITEXE" ]; then
    (cd /mnt/c && "$GITEXE" config --global core.autocrlf false >/dev/null 2>&1 </dev/null) && echo "ok: Windows git core.autocrlf=false" || warn "could not set core.autocrlf on Windows git — run in PowerShell: git config --global core.autocrlf false"
  fi
  if (cd /mnt/c && winget.exe install --id Obsidian.Obsidian -e --source winget --accept-package-agreements --accept-source-agreements >/dev/null 2>&1 </dev/null); then
    echo "ok: Obsidian installed (or already present)"
  else
    warn "winget could not install Obsidian — download it from obsidian.md on the Windows side."
  fi
else
  warn "winget.exe not reachable from WSL. In PowerShell:  winget install --id Git.Git -e ; winget install --id Obsidian.Obsidian -e"
fi

if [ "$CONFIG_OK" = 0 ]; then
  printf '\n\033[1;31mCONFIG MISSING — do this before anything else:\033[0m\n'
  echo "  Download user-config.json from the wizard (personal-os-starter.vercel.app), then in Ubuntu:"
  echo "  cp \"$WINHOME/Downloads/user-config.json\" $KIT_DIR/config/     (or OneDrive/Downloads)"
fi
say "Done. Three things left, in order:"
cat <<'EOF'
  1. Reboot Windows once (Start -> Power -> Restart). This applies the memory cap and clears
     WSL interop state. Do not skip it.
  2. Open Ubuntu (Windows Terminal) and run:
        cd ~/personal-os-installer && claude
  3. Sign in when Claude Code asks. When you see the prompt, type:  go
     The agent reads the override sheet and the runbook itself and takes it from there.
EOF
}

main "$@" </dev/null
