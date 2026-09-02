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

say "1/5  Homebrew  (this may install Apple's Command Line Tools first — 5-15 min, that's normal)"
if ! command -v brew >/dev/null 2>&1 && [ ! -x /opt/homebrew/bin/brew ] && [ ! -x /usr/local/bin/brew ]; then
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || die "Homebrew install failed."
fi
if [ -x /opt/homebrew/bin/brew ]; then BREW=/opt/homebrew/bin/brew; else BREW=/usr/local/bin/brew; fi
eval "$("$BREW" shellenv)"
touch "$HOME/.zprofile"
grep -q 'brew shellenv' "$HOME/.zprofile" || echo "eval \"\$($BREW shellenv)\"" >> "$HOME/.zprofile"
echo "ok: $(brew --version | head -1)"

say "2/5  Tools: jq, git, node, Obsidian, Ghostty"
brew install jq git node >/dev/null 2>&1 || die "brew install failed (jq/git/node)."
brew list --cask obsidian >/dev/null 2>&1 || brew install --cask obsidian >/dev/null 2>&1 || warn "Obsidian cask failed — download it from obsidian.md"
brew list --cask ghostty  >/dev/null 2>&1 || brew install --cask ghostty  >/dev/null 2>&1 || warn "Ghostty cask failed — download it from ghostty.org (or use Terminal)"
echo "ok: node $(node --version)"

say "3/5  Claude Code  (native installer)"
curl -fsSL https://claude.ai/install.sh | bash >/dev/null || die "Claude Code install failed."
LINE='export PATH="$HOME/.local/bin:$PATH"'
for rc in "$HOME/.zshrc" "$HOME/.zprofile"; do
  touch "$rc"; grep -qF "$LINE" "$rc" || echo "$LINE" >> "$rc"
done
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
else
  printf '\n\033[1;31mCONFIG MISSING — do this before anything else:\033[0m\n'
  echo "  Get user-config.json onto this Mac (AirDrop from the wizard machine), then:"
  echo "  cp ~/Downloads/user-config.json $KIT_DIR/config/"
fi

say "5/5  Done. Two things left:"
cat <<'EOF'
  1. Open a NEW terminal window (so PATH is fresh) and run:
        cd ~/personal-os-installer && claude
  2. Sign in when Claude Code asks. When you see the prompt, type:  go
     The agent reads the override sheet and the runbook itself and takes it from there.
EOF
}

main "$@" </dev/null
