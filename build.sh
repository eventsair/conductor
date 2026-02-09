#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Conductor Build Script
# Generates platform-specific packages from canonical source files.
# Output: dist/gemini/, dist/claude/, dist/augment/
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
PROMPTS_DIR="$SRC_DIR/prompts"
CONTEXT_DIR="$SRC_DIR/context"
METADATA="$SRC_DIR/metadata/commands.json"
TEMPLATES_DIR="$SCRIPT_DIR/templates"
PLATFORMS_DIR="$SCRIPT_DIR/platforms"
DIST_DIR="$SCRIPT_DIR/dist"

# ============================================================================
# Helper: Read a JSON field from commands.json
# Usage: json_field <command_name> <field>
# ============================================================================
json_field() {
    local cmd="$1" field="$2"
    python3 -c "
import json, sys
with open('$METADATA') as f:
    data = json.load(f)
val = data.get('$cmd', {}).get('$field', '')
print(val)
"
}

# ============================================================================
# Platform-specific placeholder values
# ============================================================================

# Gemini
GEMINI_USER_ARGS='{{args}}'
GEMINI_TEMPLATE_PATH='~/.gemini/extensions/conductor/templates'
GEMINI_EDITOR_HINT='the Gemini CLI built-in option "Modify with external editor" (if present), or with your favorite external editor'
GEMINI_IGNORE_FILE='.geminiignore'

# Claude Code
CLAUDE_USER_ARGS='$ARGUMENTS'
CLAUDE_TEMPLATE_PATH_MARKER='__CLAUDE_TEMPLATE_PATH_DYNAMIC__'
CLAUDE_EDITOR_HINT='your preferred text editor'
CLAUDE_IGNORE_FILE='.gitignore'

# Augment Code
AUGMENT_USER_ARGS='$ARGUMENTS'
AUGMENT_TEMPLATE_PATH_MARKER='__AUGMENT_TEMPLATE_PATH_DYNAMIC__'
AUGMENT_EDITOR_HINT='your preferred text editor'
AUGMENT_IGNORE_FILE='.gitignore'

# ============================================================================
# replace_placeholders <content> <platform>
# Replaces __PLACEHOLDER__ tokens with platform-specific values.
# Reads from stdin, writes to stdout.
# ============================================================================
replace_placeholders() {
    local platform="$1"
    local content
    content="$(cat)"

    case "$platform" in
        gemini)
            content="${content//__USER_ARGS__/$GEMINI_USER_ARGS}"
            content="${content//__TEMPLATE_PATH__/$GEMINI_TEMPLATE_PATH}"
            content="${content//__EDITOR_HINT__/$GEMINI_EDITOR_HINT}"
            content="${content//__IGNORE_FILE__/$GEMINI_IGNORE_FILE}"
            ;;
        claude)
            content="${content//__USER_ARGS__/$CLAUDE_USER_ARGS}"
            content="${content//__EDITOR_HINT__/$CLAUDE_EDITOR_HINT}"
            content="${content//__IGNORE_FILE__/$CLAUDE_IGNORE_FILE}"
            # Claude uses dynamic template path resolution
            content="${content//__TEMPLATE_PATH__/$CLAUDE_TEMPLATE_PATH_MARKER}"
            ;;
        augment)
            content="${content//__USER_ARGS__/$AUGMENT_USER_ARGS}"
            content="${content//__EDITOR_HINT__/$AUGMENT_EDITOR_HINT}"
            content="${content//__IGNORE_FILE__/$AUGMENT_IGNORE_FILE}"
            # Augment uses dynamic template path resolution
            content="${content//__TEMPLATE_PATH__/$AUGMENT_TEMPLATE_PATH_MARKER}"
            ;;
    esac

    printf '%s' "$content"
}

# ============================================================================
# wrap_toml <description> <prompt_content>
# Wraps prompt content in Gemini TOML format.
# ============================================================================
wrap_toml() {
    local description="$1"
    local prompt_content="$2"
    printf 'description = "%s"\nprompt = """\n%s\n"""\n' "$description" "$prompt_content"
}

# ============================================================================
# wrap_skill_md <name> <description>
# Wraps prompt content in Claude Code SKILL.md format (YAML frontmatter + MD).
# Reads prompt content from stdin.
# ============================================================================
wrap_skill_md() {
    local name="$1"
    local description="$2"
    local prompt_content
    prompt_content="$(cat)"

    cat <<SKILLEOF
---
name: $name
description: $description
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

$prompt_content
SKILLEOF
}

# ============================================================================
# wrap_augment_md <name> <description>
# Wraps prompt content in Augment Code .md format (YAML frontmatter + MD).
# Reads prompt content from stdin.
# ============================================================================
wrap_augment_md() {
    local name="$1"
    local description="$2"
    local prompt_content
    prompt_content="$(cat)"

    cat <<AUGEOF
---
name: $name
description: $description
---

$prompt_content
AUGEOF
}

# ============================================================================
# inject_claude_template_resolution <content>
# Replaces the Claude template path marker with dynamic find-based resolution.
# ============================================================================
inject_claude_template_resolution() {
    local content="$1"
    local dynamic_block
    dynamic_block='$(find ~ -path "*/conductor/templates/workflow.md" -not -path "*/.git/*" 2>/dev/null | head -1 | xargs dirname | xargs dirname)/templates'
    content="${content//$CLAUDE_TEMPLATE_PATH_MARKER/$dynamic_block}"
    printf '%s' "$content"
}

# ============================================================================
# inject_augment_template_resolution <content>
# Replaces the Augment template path marker with dynamic find-based resolution.
# ============================================================================
inject_augment_template_resolution() {
    local content="$1"
    local dynamic_block
    dynamic_block='$(find ~ -path "*/conductor/templates/workflow.md" -not -path "*/.git/*" 2>/dev/null | head -1 | xargs dirname | xargs dirname)/templates'
    content="${content//$AUGMENT_TEMPLATE_PATH_MARKER/$dynamic_block}"
    printf '%s' "$content"
}

# ============================================================================
# generate_context_file <platform>
# Generates the context file (GEMINI.md or CLAUDE.md) from canonical source.
# ============================================================================
generate_context_file() {
    local platform="$1"
    local output_path="$2"
    cp "$CONTEXT_DIR/file-resolution.md" "$output_path"
}

# ============================================================================
# Build all commands for a given platform
# ============================================================================
build_commands() {
    local platform="$1"

    # Get list of commands from metadata
    local commands
    commands=$(python3 -c "
import json
with open('$METADATA') as f:
    data = json.load(f)
for cmd in data:
    print(cmd)
")

    for cmd in $commands; do
        local source_file description

        source_file=$(json_field "$cmd" "source_file")
        if [ -z "$source_file" ]; then
            source_file="${cmd}.md"
        fi

        description=$(json_field "$cmd" "description")

        local prompt_path="$PROMPTS_DIR/$source_file"
        if [ ! -f "$prompt_path" ]; then
            echo "WARNING: Source file not found: $prompt_path (skipping $cmd)"
            continue
        fi

        local prompt_content
        prompt_content=$(cat "$prompt_path" | replace_placeholders "$platform")

        case "$platform" in
            gemini)
                local output_path="$DIST_DIR/gemini/commands/conductor/${cmd}.toml"
                mkdir -p "$(dirname "$output_path")"
                wrap_toml "$description" "$prompt_content" > "$output_path"
                ;;
            claude)
                prompt_content=$(inject_claude_template_resolution "$prompt_content")
                local output_path="$DIST_DIR/claude/skills/${cmd}/SKILL.md"
                mkdir -p "$(dirname "$output_path")"
                printf '%s' "$prompt_content" | wrap_skill_md "$cmd" "$description" > "$output_path"
                ;;
            augment)
                prompt_content=$(inject_augment_template_resolution "$prompt_content")
                local output_path="$DIST_DIR/augment/.augment/commands/conductor/${cmd}.md"
                mkdir -p "$(dirname "$output_path")"
                printf '%s' "$prompt_content" | wrap_augment_md "$cmd" "$description" > "$output_path"
                ;;
        esac

        echo "  Built: $cmd ($platform)"
    done
}

# ============================================================================
# Main build
# ============================================================================
main() {
    echo "=== Conductor Build ==="
    echo ""

    # Clean dist
    rm -rf "$DIST_DIR"

    # ------------------------------------------------------------------
    # Build Gemini
    # ------------------------------------------------------------------
    echo "Building Gemini..."
    mkdir -p "$DIST_DIR/gemini"

    build_commands "gemini"

    # Context file
    generate_context_file "gemini" "$DIST_DIR/gemini/GEMINI.md"

    # Manifest
    cp "$PLATFORMS_DIR/gemini/gemini-extension.json" "$DIST_DIR/gemini/gemini-extension.json"

    # Templates
    cp -r "$TEMPLATES_DIR" "$DIST_DIR/gemini/templates"

    echo ""

    # ------------------------------------------------------------------
    # Build Claude Code
    # ------------------------------------------------------------------
    echo "Building Claude Code..."
    mkdir -p "$DIST_DIR/claude/.claude-plugin"

    build_commands "claude"

    # Context file
    generate_context_file "claude" "$DIST_DIR/claude/CLAUDE.md"

    # Manifest
    cp "$PLATFORMS_DIR/claude/plugin.json" "$DIST_DIR/claude/.claude-plugin/plugin.json"

    # Templates
    cp -r "$TEMPLATES_DIR" "$DIST_DIR/claude/templates"

    echo ""

    # ------------------------------------------------------------------
    # Build Augment Code
    # ------------------------------------------------------------------
    echo "Building Augment Code..."
    mkdir -p "$DIST_DIR/augment"

    build_commands "augment"

    # Context file (Augment supports CLAUDE.md natively)
    generate_context_file "augment" "$DIST_DIR/augment/CLAUDE.md"

    # Templates
    cp -r "$TEMPLATES_DIR" "$DIST_DIR/augment/templates"

    echo ""
    echo "=== Build Complete ==="
    echo "Output directories:"
    echo "  dist/gemini/   - Gemini CLI extension"
    echo "  dist/claude/   - Claude Code plugin"
    echo "  dist/augment/  - Augment Code commands"
}

main "$@"
