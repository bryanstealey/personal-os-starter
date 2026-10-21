#!/usr/bin/env bash
# Personal OS bootstrap — Mac (Apple Silicon or Intel).
# Run in Terminal:
#   curl -fsSL https://personal-os-starter.vercel.app/mac.sh | bash
# Everything up to "claude is authenticated" happens here. Idempotent — safe to re-run.
set -uo pipefail
KIT_REPO="https://github.com/bryanstealey/personal-os-starter.git"
KIT_DIR="$HOME/personal-os-installer"
say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mSTOP: %s\033[0m\n' "$*"; exit 1; }

main() {

say "0/5  Admin check + password  (Homebrew needs an Administrator account; enter your Mac login password once)"
dsmemberutil checkmembership -U "$USER" -G admin 2>/dev/null | grep -q 'is a member' \
  || die "This Mac account is not an Administrator. Homebrew cannot install. Sign in as an admin user, or have IT grant admin, then re-run."
sudo -v </dev/tty || die "Could not get sudo. Check the password and re-run."
# keep the sudo timestamp warm while Command Line Tools download (can take 15 min)
( while true; do sudo -n true; sleep 60; kill -0 "$$" 2>/dev/null || exit; done ) 2>/dev/null &
KEEPALIVE=$!

say "1/5  Apple Command Line Tools + Homebrew  (5-15 min the first time, that's normal)"
# Homebrew's own headless download of the Command Line Tools can fail to reach Apple's
# Software Update server (Rob M., Oct 21 2026). Install them through Apple's popup first.
if ! xcode-select -p >/dev/null 2>&1; then
  xcode-select --install >/dev/null 2>&1 || true
  echo "A window popped up asking to install the Command Line Tools. Click Install, then Agree."
  echo "Waiting here until it finishes (up to 30 min)..."
  for _ in $(seq 1 180); do xcode-select -p >/dev/null 2>&1 && break; sleep 10; done
  xcode-select -p >/dev/null 2>&1 \
    || die "The Command Line Tools did not finish installing. Run:  xcode-select --install   click Install in the popup, wait for it to finish, then re-run this script."
fi
echo "ok: Command Line Tools at $(xcode-select -p)"
if ! command -v brew >/dev/null 2>&1 && [ ! -x /opt/homebrew/bin/brew ] && [ ! -x /usr/local/bin/brew ]; then
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
    || die "Homebrew install failed. If the error above mentions Command Line Tools or Software Update, run:  xcode-select --install   click Install, then re-run. If it mentions certificates, this is corporate network TLS inspection: switch to a phone hotspot and re-run."
fi
if [ -x /opt/homebrew/bin/brew ]; then BREW=/opt/homebrew/bin/brew; else BREW=/usr/local/bin/brew; fi
eval "$("$BREW" shellenv)"
for rc in "$HOME/.zprofile" "$HOME/.bash_profile"; do
  touch "$rc"; grep -q 'brew shellenv' "$rc" || echo "eval \"\$($BREW shellenv)\"" >> "$rc"
done
echo "ok: $(brew --version | head -1)"

say "2/5  Tools: jq, git, node, Obsidian, Ghostty"
brew install jq git node >/dev/null || die "brew install failed (jq/git/node). Cert errors = corporate TLS inspection: phone hotspot and re-run."
brew list --cask obsidian >/dev/null 2>&1 || brew install --cask obsidian >/dev/null 2>&1 || warn "Obsidian cask failed — download it from obsidian.md"
brew list --cask ghostty  >/dev/null 2>&1 || brew install --cask ghostty  >/dev/null 2>&1 || warn "Ghostty cask failed — download it from ghostty.org (or use Terminal)"
echo "ok: node $(node --version)"

say "3/5  Claude Code  (native installer)"
curl -fsSL https://claude.ai/install.sh | bash || die "Claude Code install failed. Cert errors = corporate TLS inspection: phone hotspot and re-run."
LINE='export PATH="$HOME/.local/bin:$PATH"'
for rc in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.bash_profile"; do
  touch "$rc"; grep -qF "$LINE" "$rc" || echo "$LINE" >> "$rc"
done
# Older Mac accounts still log in to bash, which never reads the zsh files (Rob M., Oct 21 2026).
# Switch bash accounts (only) to zsh, the macOS default since 2019; .bash_profile above covers it if the switch fails.
LOGIN_SHELL="$(dscl . -read "/Users/$USER" UserShell 2>/dev/null | awk '{print $2}')"
if [ "${LOGIN_SHELL##*/}" = "bash" ]; then
  sudo chsh -s /bin/zsh "$USER" >/dev/null 2>&1 && echo "ok: login shell switched from ${LOGIN_SHELL:-unknown} to zsh" \
    || warn "Could not switch the login shell to zsh. PATH was added to ~/.bash_profile too, so claude should still be found."
fi
export PATH="$HOME/.local/bin:$PATH"
command -v claude >/dev/null || die "claude is not on PATH after install."
echo "ok: claude $(claude --version 2>/dev/null | head -1)"

say "4/5  The kit + your config"
if [ -d "$KIT_DIR/.git" ]; then
  git -C "$KIT_DIR" pull -q --ff-only || warn "kit pull failed; using the existing copy"
elif [ -e "$KIT_DIR" ]; then
  die "$KIT_DIR exists but is not a git checkout (interrupted earlier?). Run:  mv $KIT_DIR $KIT_DIR.old   then re-run this script."
else
  git clone -q "$KIT_REPO" "$KIT_DIR" || die "Could not clone the kit."
fi
if [ -f "$HOME/Downloads/user-config.json" ]; then
  cp "$HOME/Downloads/user-config.json" "$KIT_DIR/config/user-config.json" && echo "config copied from ~/Downloads"
  # git identity for the vault's commits (a new Mac has none; Obsidian Git and Section 23 both need it)
  GN="$(jq -r '.userName // empty' "$KIT_DIR/config/user-config.json" 2>/dev/null)"
  GE="$(jq -r '.googleAccounts[0].email // empty' "$KIT_DIR/config/user-config.json" 2>/dev/null)"
  [ -n "$GN" ] && git config --global user.name "$GN"
  [ -n "$GE" ] && git config --global user.email "$GE"
  [ -n "$GN" ] && [ -n "$GE" ] && echo "ok: git identity set for $GN"
else
  printf '\n\033[1;31mCONFIG MISSING — do this before anything else:\033[0m\n'
  echo "  Get user-config.json onto this Mac (AirDrop from the wizard machine), then:"
  echo "  cp ~/Downloads/user-config.json $KIT_DIR/config/"
fi

kill "$KEEPALIVE" 2>/dev/null || true
say "5/5  Done. Two things left:"
cat <<'EOF'
  1. Open a NEW terminal window (so PATH is fresh) and run:
        cd ~/personal-os-installer && claude
  2. Sign in when Claude Code asks. When you see the prompt, type:  go
     The agent reads the override sheet and the runbook itself and takes it from there.
EOF
}

main "$@" </dev/null
