#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Conductor - GitHub Copilot Agent Skills Installer
#
# Copies Conductor Agent Skills into a target project directory.
# Run this after ./build.sh has completed.
#
# Usage: ./install-copilot.sh [target-directory]
# If no directory is specified, uses the current directory.
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_COPILOT="$SCRIPT_DIR/dist/copilot"

# Get target directory from argument or use current directory
TARGET_DIR="${1:-.}"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

# Verify build output exists
if [ ! -d "$DIST_COPILOT/.github" ]; then
    echo "Error: dist/copilot/ not found. Run ./build.sh first."
    exit 1
fi

echo "=== Conductor GitHub Copilot Installer ==="
echo "Target directory: $TARGET_DIR"
echo ""

# Create .github directory if it doesn't exist
mkdir -p "$TARGET_DIR/.github"

# Copy or update skills
if [ -d "$TARGET_DIR/.github/skills" ]; then
    echo "Updating existing skills..."
    # Remove old conductor skills
    rm -rf "$TARGET_DIR/.github/skills/"{setup,newTrack,implement,review,status,revert}
else
    echo "Creating skills directory..."
    mkdir -p "$TARGET_DIR/.github/skills"
fi

# Copy conductor skills
echo "Installing Conductor Agent Skills..."
cp -r "$DIST_COPILOT/.github/skills/"* "$TARGET_DIR/.github/skills/"

# Copy context file
echo "Installing context file..."
cp "$DIST_COPILOT/COPILOT.md" "$TARGET_DIR/"

# Copy templates
if [ -d "$TARGET_DIR/templates" ]; then
    echo "Templates directory already exists, skipping..."
else
    echo "Installing templates..."
    cp -r "$DIST_COPILOT/templates" "$TARGET_DIR/"
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Conductor Agent Skills installed to: $TARGET_DIR/.github/skills"
echo ""
echo "Available skills:"
echo "  - setup: Scaffolds the project and sets up the Conductor environment"
echo "  - newTrack: Plans a track, generates spec documents"
echo "  - implement: Executes the tasks defined in the track's plan"
echo "  - review: Reviews completed work against guidelines"
echo "  - status: Displays current project progress"
echo "  - revert: Reverts previous work"
echo ""
echo "Usage in GitHub Copilot Chat:"
echo "  - \"Set up the conductor project\""
echo "  - \"Create a new track for [feature description]\""
echo "  - \"Implement the current track\""
echo "  - \"Show conductor project status\""
echo "  - \"Review the current track work\""
echo "  - \"Revert the latest conductor changes\""
echo ""
echo "The skills will be automatically detected by GitHub Copilot in VS Code."
