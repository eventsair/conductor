#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Conductor - Claude Code Plugin Installer
#
# Registers a local marketplace and installs the Conductor plugin into
# Claude Code. Run this after ./build.sh has completed.
#
# Usage: ./install-claude.sh
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_CLAUDE="$SCRIPT_DIR/dist/claude"
MARKETPLACE_DIR="$SCRIPT_DIR/dist/claude-marketplace"

# Verify build output exists
if [ ! -d "$DIST_CLAUDE/.claude-plugin" ]; then
    echo "Error: dist/claude/ not found. Run ./build.sh first."
    exit 1
fi

# Read version from plugin manifest
VERSION=$(python3 -c "import json; print(json.load(open('$DIST_CLAUDE/.claude-plugin/plugin.json'))['version'])")

echo "=== Conductor Claude Code Installer ==="
echo "Version: $VERSION"
echo ""

# Create local marketplace structure with absolute path to dist/claude
mkdir -p "$MARKETPLACE_DIR/.claude-plugin"
mkdir -p "$MARKETPLACE_DIR/plugins"

cat > "$MARKETPLACE_DIR/.claude-plugin/marketplace.json" <<EOF
{
  "name": "conductor-local",
  "description": "Local marketplace for the Conductor plugin",
  "owner": {
    "name": "EventsAir"
  },
  "plugins": [
    {
      "name": "conductor",
      "description": "Conductor: AI-driven spec-based development framework for managing tracks, specs, and plans",
      "version": "$VERSION",
      "source": "./plugins/conductor",
      "category": "development"
    }
  ]
}
EOF

# Symlink plugin into marketplace (use absolute path for reliability)
ln -sfn "$DIST_CLAUDE" "$MARKETPLACE_DIR/plugins/conductor"

# Remove existing marketplace registration if present (ignore errors)
claude plugin marketplace remove conductor-local 2>/dev/null || true

# Remove existing plugin installation if present (ignore errors)
claude plugin uninstall conductor@conductor-local 2>/dev/null || true

# Register marketplace and install
echo "Registering local marketplace..."
claude plugin marketplace add "$MARKETPLACE_DIR"

echo ""
echo "Installing conductor plugin..."
claude plugin install conductor@conductor-local

echo ""
echo "=== Installation Complete ==="
echo "Restart Claude Code to load the plugin."
echo "Available commands: /conductor:setup, /conductor:newTrack, /conductor:implement, /conductor:status, /conductor:review, /conductor:revert"
