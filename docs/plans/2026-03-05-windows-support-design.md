# Design: Cross-Platform Windows Support

**Date:** 2026-03-05
**Status:** Approved

## Problem

Conductor's build and install scripts (`build.sh`, `install-claude.sh`) are bash-only and do not work on Windows. Windows users cannot set up Conductor natively.

## Solution

Replace bash scripts with a single set of Node.js scripts that run identically on Mac, Linux, and Windows. No separate `.ps1` scripts to maintain.

## Files

### Deleted
- `build.sh` — replaced by `build.js`
- `install-claude.sh` — replaced by `install-claude.js`

### New
- `build.js` — cross-platform build script (Node.js)
- `install-claude.js` — cross-platform Claude Code installer (Node.js)
- `install-augment.js` — cross-platform Augment Code installer (Node.js); takes target project path as argument
- `package.json` — npm scripts for all three scripts

### Modified
- `README.md` — restructured installation section with Mac/Linux and Windows sub-sections per platform

## Design Details

### `build.js`

Mirrors `build.sh` behavior exactly, using Node.js built-ins:

| bash | Node.js |
|------|---------|
| `rm -rf` | `fs.rmSync(dir, { recursive: true })` |
| `cp -r` | `fs.cpSync(src, dest, { recursive: true })` |
| `mkdir -p` | `fs.mkdirSync(dir, { recursive: true })` |
| `python3 -c 'import json...'` | `JSON.parse(fs.readFileSync(...))` |
| `${content//__PLACEHOLDER__/$VALUE}` | `content.replaceAll('__PLACEHOLDER__', value)` |
| heredoc string formatting | template literals |

**Platform-aware template path injection:**

The build script embeds a runtime shell command into generated Claude/Augment skill files so Claude can dynamically locate the `templates/` directory. The injected command differs by platform:

- **Mac/Linux** (injected into skill files built on Unix):
  ```bash
  $(find ~ -path "*/conductor/templates/workflow.md" -not -path "*/.git/*" 2>/dev/null | head -1 | xargs dirname | xargs dirname)/templates
  ```

- **Windows** (injected into skill files built on Windows):
  ```powershell
  $(& { $f=(Get-ChildItem -Path $HOME -Recurse -Filter 'workflow.md' -EA SilentlyContinue | Where-Object {$_.FullName -like '*\conductor\templates\workflow.md' -and $_.FullName -notlike '*\.git\*'} | Select-Object -First 1); if($f){(Split-Path (Split-Path $f.FullName -Parent) -Parent)+'\templates'} })
  ```

Detection: `process.platform === 'win32'` auto-detects the platform at build time. Override with `--platform win32|unix` flag.

### `install-claude.js`

Mirrors `install-claude.sh` behavior:

1. Reads version from `dist/claude/.claude-plugin/plugin.json`
2. Creates marketplace directory and writes `marketplace.json`
3. Copies plugin files into marketplace (no symlinks — avoids Windows admin requirement)
4. Calls `claude plugin marketplace remove`, `claude plugin marketplace add`, `claude plugin install`

**CLI invocation:** Use `child_process.spawnSync` (not `execSync`) to call the `claude` binary directly with arguments as an array. This avoids shell injection and handles spaces in paths correctly on all platforms:
```js
spawnSync('claude', ['plugin', 'marketplace', 'add', marketplacePath], { stdio: 'inherit' })
```

**No symlinks:** `install-claude.sh` uses `ln -sfn` which requires admin rights on Windows. The Node.js version uses `fs.cpSync` instead — simpler and cross-platform.

### `install-augment.js`

New script. Replaces the manual `cp` steps currently in the README.

Usage:
```bash
node install-augment.js /path/to/your/project
```

Copies into target project:
- `dist/augment/.augment/` → `<target>/.augment/`
- `dist/augment/CLAUDE.md` → `<target>/CLAUDE.md`
- `dist/augment/templates/` → `<target>/.augment/templates/`

### `package.json`

```json
{
  "name": "conductor",
  "version": "...",
  "scripts": {
    "build": "node build.js",
    "install-claude": "node install-claude.js",
    "install-augment": "node install-augment.js"
  }
}
```

### README Structure

Each platform gets two sub-sections. Since Node.js is cross-platform, the commands are identical — the Windows section adds a prerequisites note.

```
### Gemini CLI
(Single command, same on all platforms — no sub-sections needed)

### Claude Code
#### Mac / Linux
#### Windows

### Augment Code
#### Mac / Linux
#### Windows
```

**Gemini CLI** — unchanged, no build step required:
```bash
gemini extensions install https://github.com/eventsair/conductor --auto-update
```

**Claude Code (both platforms):**
```bash
git clone https://github.com/eventsair/conductor.git
cd conductor
node build.js
node install-claude.js
```
Windows section adds: "Requires Node.js 18+ (nodejs.org)"

**Augment Code (both platforms):**
```bash
git clone https://github.com/eventsair/conductor.git
cd conductor
node build.js
node install-augment.js /path/to/your/project
```
Windows path example: `node install-augment.js C:\path\to\your\project`

## Prerequisites

- **Mac/Linux:** No new prerequisites. Node.js is required (likely already installed by most developers).
- **Windows:** Node.js 18+ (nodejs.org). No other tools required.

## Security Notes

- CLI tools (`claude`) are called via `spawnSync` with args as an array — no shell interpolation.
- Target paths in `install-augment.js` are validated to be absolute before use.

## Out of Scope

- Changes to prompt content in `src/prompts/`
- Changes to platform manifests in `platforms/`
- CI/CD changes
