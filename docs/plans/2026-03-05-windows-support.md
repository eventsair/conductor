# Windows Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace bash-only build/install scripts with cross-platform Node.js equivalents so Windows users can build and install Conductor without WSL or Git Bash.

**Architecture:** Three Node.js scripts replace `build.sh` and `install-claude.sh`: `build.js` (cross-platform build), `install-claude.js` (Claude Code plugin installer), and `install-augment.js` (new Augment Code installer). The build script auto-detects the OS and injects a platform-appropriate runtime template path into generated skill files. Pure functions in `build.js` are covered by unit tests in `build.test.js` using Node's built-in `assert` module.

**Tech Stack:** Node.js 18+ (built-in `fs`, `path`, `child_process`, `assert`). No npm dependencies.

---

## Context: What the build script does

Read `src/metadata/commands.json` to get command names and descriptions. For each command, read its source file from `src/prompts/`, replace `__PLACEHOLDER__` tokens with platform-specific values, wrap in the platform format (TOML for Gemini, SKILL.md for Claude, `.md` for Augment), and write to `dist/`. Also copy context files and templates.

The `__TEMPLATE_PATH__` placeholder is special: it becomes a runtime shell expression embedded in the generated skill file so Claude can find the templates directory on the user's machine. On Unix this is a `$(find ...)` bash expression; on Windows it's a PowerShell `$(& { Get-ChildItem ... })` expression.

## Key files to read before starting

- `build.sh` — full reference implementation
- `install-claude.sh` — full reference for install logic
- `src/metadata/commands.json` — command list and descriptions
- `src/prompts/` — source prompt files
- `platforms/claude/plugin.json` — version source for install script
- `README.md` — installation section to update

---

### Task 1: Create `package.json`

**Files:**
- Create: `package.json`

**Step 1: Create `package.json`**

```json
{
  "name": "conductor",
  "version": "0.1.0",
  "description": "Cross-platform AI development framework",
  "scripts": {
    "build": "node build.js",
    "install-claude": "node install-claude.js",
    "install-augment": "node install-augment.js"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 2: Verify**

```bash
node -e "const p = require('./package.json'); console.log(p.scripts.build)"
```
Expected: `node build.js`

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add package.json for cross-platform Node.js scripts"
```

---

### Task 2: Write unit tests for `build.js` pure functions

These tests cover placeholder replacement, TOML/SKILL.md/Augment wrapping, and template path injection. Write the tests first — they will all fail until Task 3 implements the functions.

**Files:**
- Create: `build.test.js`

**Step 1: Write `build.test.js`**

```js
// build.test.js
const assert = require('assert');

// Import the functions under test.
// build.js must export these for testing.
const {
  replacePlaceholders,
  wrapToml,
  wrapSkillMd,
  wrapAugmentMd,
  injectTemplateResolution,
} = require('./build.js');

// ── replacePlaceholders ──────────────────────────────────────────────────────

{
  const content = 'args=__USER_ARGS__ editor=__EDITOR_HINT__ ignore=__IGNORE_FILE__ path=__TEMPLATE_PATH__';

  const gemini = replacePlaceholders(content, 'gemini');
  assert.strictEqual(gemini, 'args={{args}} editor=the Gemini CLI built-in option "Modify with external editor" (if present), or with your favorite external editor ignore=.geminiignore path=~/.gemini/extensions/conductor/templates');

  const claude = replacePlaceholders(content, 'claude');
  assert.ok(claude.includes('args=$ARGUMENTS'), 'claude USER_ARGS');
  assert.ok(claude.includes('editor=your preferred text editor'), 'claude EDITOR_HINT');
  assert.ok(claude.includes('ignore=.gitignore'), 'claude IGNORE_FILE');
  assert.ok(claude.includes('path=__CLAUDE_TEMPLATE_PATH_DYNAMIC__'), 'claude TEMPLATE_PATH marker');

  const augment = replacePlaceholders(content, 'augment');
  assert.ok(augment.includes('args=$ARGUMENTS'), 'augment USER_ARGS');
  assert.ok(augment.includes('path=__AUGMENT_TEMPLATE_PATH_DYNAMIC__'), 'augment TEMPLATE_PATH marker');

  console.log('✓ replacePlaceholders');
}

// ── wrapToml ─────────────────────────────────────────────────────────────────

{
  const result = wrapToml('My description', 'prompt body here');
  assert.ok(result.startsWith('description = "My description"'), 'toml description');
  assert.ok(result.includes('prompt = """'), 'toml prompt start');
  assert.ok(result.includes('prompt body here'), 'toml content');
  assert.ok(result.endsWith('"""\n'), 'toml end');
  console.log('✓ wrapToml');
}

// ── wrapSkillMd ──────────────────────────────────────────────────────────────

{
  const result = wrapSkillMd('setup', 'Sets up the project', 'body content');
  assert.ok(result.startsWith('---\n'), 'skill frontmatter start');
  assert.ok(result.includes('name: setup'), 'skill name');
  assert.ok(result.includes('description: Sets up the project'), 'skill description');
  assert.ok(result.includes('allowed-tools: Bash, Read, Write, Edit, Grep, Glob'), 'skill tools');
  assert.ok(result.includes('body content'), 'skill body');
  console.log('✓ wrapSkillMd');
}

// ── wrapAugmentMd ────────────────────────────────────────────────────────────

{
  const result = wrapAugmentMd('setup', 'Sets up the project', 'body content');
  assert.ok(result.startsWith('---\n'), 'augment frontmatter start');
  assert.ok(result.includes('name: setup'), 'augment name');
  assert.ok(result.includes('description: Sets up the project'), 'augment description');
  assert.ok(result.includes('body content'), 'augment body');
  console.log('✓ wrapAugmentMd');
}

// ── injectTemplateResolution ─────────────────────────────────────────────────

{
  const marker = '__CLAUDE_TEMPLATE_PATH_DYNAMIC__';
  const input = `ls ${marker}/code_styleguides/`;

  const unix = injectTemplateResolution(input, marker, 'unix');
  assert.ok(unix.includes('find ~'), 'unix uses find');
  assert.ok(unix.includes('conductor/templates/workflow.md'), 'unix path');
  assert.ok(!unix.includes(marker), 'unix marker replaced');

  const win = injectTemplateResolution(input, marker, 'win32');
  assert.ok(win.includes('Get-ChildItem'), 'win uses Get-ChildItem');
  assert.ok(win.includes('workflow.md'), 'win path');
  assert.ok(!win.includes(marker), 'win marker replaced');

  console.log('✓ injectTemplateResolution');
}

console.log('\nAll tests passed.');
```

**Step 2: Run tests to confirm they fail (functions don't exist yet)**

```bash
node build.test.js
```
Expected: `Error: Cannot find module './build.js'` (or similar — file doesn't exist yet)

**Step 3: Commit the tests**

```bash
git add build.test.js
git commit -m "test: add unit tests for build.js pure functions"
```

---

### Task 3: Implement `build.js`

**Files:**
- Create: `build.js`

**Step 1: Write `build.js`**

```js
'use strict';
const fs = require('fs');
const path = require('path');

// ── Paths ────────────────────────────────────────────────────────────────────

const SCRIPT_DIR = __dirname;
const PROMPTS_DIR = path.join(SCRIPT_DIR, 'src', 'prompts');
const CONTEXT_DIR = path.join(SCRIPT_DIR, 'src', 'context');
const METADATA    = path.join(SCRIPT_DIR, 'src', 'metadata', 'commands.json');
const TEMPLATES_DIR = path.join(SCRIPT_DIR, 'templates');
const PLATFORMS_DIR = path.join(SCRIPT_DIR, 'platforms');
const DIST_DIR    = path.join(SCRIPT_DIR, 'dist');

// ── Platform config ──────────────────────────────────────────────────────────

const PLATFORM_VALUES = {
  gemini: {
    USER_ARGS:     '{{args}}',
    TEMPLATE_PATH: '~/.gemini/extensions/conductor/templates',
    EDITOR_HINT:   'the Gemini CLI built-in option "Modify with external editor" (if present), or with your favorite external editor',
    IGNORE_FILE:   '.geminiignore',
  },
  claude: {
    USER_ARGS:              '$ARGUMENTS',
    TEMPLATE_PATH_MARKER:   '__CLAUDE_TEMPLATE_PATH_DYNAMIC__',
    EDITOR_HINT:            'your preferred text editor',
    IGNORE_FILE:            '.gitignore',
  },
  augment: {
    USER_ARGS:              '$ARGUMENTS',
    TEMPLATE_PATH_MARKER:   '__AUGMENT_TEMPLATE_PATH_DYNAMIC__',
    EDITOR_HINT:            'your preferred text editor',
    IGNORE_FILE:            '.gitignore',
  },
};

// ── Template path expressions ─────────────────────────────────────────────────

const UNIX_TEMPLATE_PATH =
  '$(find ~ -path "*/conductor/templates/workflow.md" -not -path "*/.git/*" 2>/dev/null | head -1 | xargs dirname | xargs dirname)/templates';

const WIN_TEMPLATE_PATH =
  "$(& { $f=(Get-ChildItem -Path $HOME -Recurse -Filter 'workflow.md' -EA SilentlyContinue" +
  " | Where-Object {$_.FullName -like '*\\conductor\\templates\\workflow.md'" +
  " -and $_.FullName -notlike '*\\.git\\*'} | Select-Object -First 1);" +
  " if($f){(Split-Path (Split-Path $f.FullName -Parent) -Parent)+'\\templates'} })";

// ── Exported pure functions (also used by build.test.js) ──────────────────────

function replacePlaceholders(content, platform) {
  const v = PLATFORM_VALUES[platform];
  content = content.replaceAll('__USER_ARGS__',   v.USER_ARGS);
  content = content.replaceAll('__EDITOR_HINT__', v.EDITOR_HINT);
  content = content.replaceAll('__IGNORE_FILE__', v.IGNORE_FILE);
  if (platform === 'gemini') {
    content = content.replaceAll('__TEMPLATE_PATH__', v.TEMPLATE_PATH);
  } else {
    content = content.replaceAll('__TEMPLATE_PATH__', v.TEMPLATE_PATH_MARKER);
  }
  return content;
}

function wrapToml(description, promptContent) {
  return `description = "${description}"\nprompt = """\n${promptContent}\n"""\n`;
}

function wrapSkillMd(name, description, promptContent) {
  return `---\nname: ${name}\ndescription: ${description}\nallowed-tools: Bash, Read, Write, Edit, Grep, Glob\n---\n\n${promptContent}`;
}

function wrapAugmentMd(name, description, promptContent) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${promptContent}`;
}

/**
 * @param {string} content
 * @param {string} marker   e.g. '__CLAUDE_TEMPLATE_PATH_DYNAMIC__'
 * @param {string} platform 'win32' | 'unix'
 */
function injectTemplateResolution(content, marker, platform) {
  const expr = platform === 'win32' ? WIN_TEMPLATE_PATH : UNIX_TEMPLATE_PATH;
  return content.replaceAll(marker, expr);
}

// ── Build helpers ─────────────────────────────────────────────────────────────

function detectPlatform() {
  const idx = process.argv.indexOf('--platform');
  if (idx !== -1) return process.argv[idx + 1];
  return process.platform; // 'win32', 'darwin', 'linux', etc.
}

function buildCommands(platform, osPlatform) {
  const commands = JSON.parse(fs.readFileSync(METADATA, 'utf8'));

  for (const [cmd, meta] of Object.entries(commands)) {
    const sourceFile = meta.source_file || `${cmd}.md`;
    const description = meta.description || '';
    const promptPath = path.join(PROMPTS_DIR, sourceFile);

    if (!fs.existsSync(promptPath)) {
      console.warn(`  WARNING: ${promptPath} not found, skipping ${cmd}`);
      continue;
    }

    let content = fs.readFileSync(promptPath, 'utf8');
    content = replacePlaceholders(content, platform);

    if (platform === 'claude') {
      content = injectTemplateResolution(content, PLATFORM_VALUES.claude.TEMPLATE_PATH_MARKER, osPlatform);
      const outPath = path.join(DIST_DIR, 'claude', 'skills', cmd, 'SKILL.md');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, wrapSkillMd(cmd, description, content));
    } else if (platform === 'augment') {
      content = injectTemplateResolution(content, PLATFORM_VALUES.augment.TEMPLATE_PATH_MARKER, osPlatform);
      const outPath = path.join(DIST_DIR, 'augment', '.augment', 'commands', 'conductor', `${cmd}.md`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, wrapAugmentMd(cmd, description, content));
    } else if (platform === 'gemini') {
      const outPath = path.join(DIST_DIR, 'gemini', 'commands', 'conductor', `${cmd}.toml`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, wrapToml(description, content));
    }

    console.log(`  Built: ${cmd} (${platform})`);
  }
}

function main() {
  const osPlatform = detectPlatform();
  console.log(`=== Conductor Build ===`);
  console.log(`Platform: ${osPlatform}`);
  console.log('');

  // Clean dist
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }

  // ── Gemini ──────────────────────────────────────────────────────────────────
  console.log('Building Gemini...');
  fs.mkdirSync(path.join(DIST_DIR, 'gemini'), { recursive: true });
  buildCommands('gemini', osPlatform);
  fs.copyFileSync(
    path.join(CONTEXT_DIR, 'file-resolution.md'),
    path.join(DIST_DIR, 'gemini', 'GEMINI.md'),
  );
  fs.copyFileSync(
    path.join(PLATFORMS_DIR, 'gemini', 'gemini-extension.json'),
    path.join(DIST_DIR, 'gemini', 'gemini-extension.json'),
  );
  fs.cpSync(TEMPLATES_DIR, path.join(DIST_DIR, 'gemini', 'templates'), { recursive: true });
  console.log('');

  // ── Claude Code ─────────────────────────────────────────────────────────────
  console.log('Building Claude Code...');
  fs.mkdirSync(path.join(DIST_DIR, 'claude', '.claude-plugin'), { recursive: true });
  buildCommands('claude', osPlatform);
  fs.copyFileSync(
    path.join(CONTEXT_DIR, 'file-resolution.md'),
    path.join(DIST_DIR, 'claude', 'CLAUDE.md'),
  );
  fs.copyFileSync(
    path.join(PLATFORMS_DIR, 'claude', 'plugin.json'),
    path.join(DIST_DIR, 'claude', '.claude-plugin', 'plugin.json'),
  );
  fs.cpSync(TEMPLATES_DIR, path.join(DIST_DIR, 'claude', 'templates'), { recursive: true });
  console.log('');

  // ── Augment Code ─────────────────────────────────────────────────────────────
  console.log('Building Augment Code...');
  fs.mkdirSync(path.join(DIST_DIR, 'augment'), { recursive: true });
  buildCommands('augment', osPlatform);
  fs.copyFileSync(
    path.join(CONTEXT_DIR, 'file-resolution.md'),
    path.join(DIST_DIR, 'augment', 'CLAUDE.md'),
  );
  fs.cpSync(TEMPLATES_DIR, path.join(DIST_DIR, 'augment', 'templates'), { recursive: true });
  console.log('');

  console.log('=== Build Complete ===');
  console.log('Output directories:');
  console.log('  dist/gemini/   - Gemini CLI extension');
  console.log('  dist/claude/   - Claude Code plugin');
  console.log('  dist/augment/  - Augment Code commands');
}

// Export pure functions for testing; run main() only when executed directly.
if (require.main === module) {
  main();
}

module.exports = { replacePlaceholders, wrapToml, wrapSkillMd, wrapAugmentMd, injectTemplateResolution };
```

**Step 2: Run the unit tests**

```bash
node build.test.js
```
Expected:
```
✓ replacePlaceholders
✓ wrapToml
✓ wrapSkillMd
✓ wrapAugmentMd
✓ injectTemplateResolution

All tests passed.
```

**Step 3: Run the build and verify output structure**

```bash
node build.js
```
Expected output ends with:
```
=== Build Complete ===
Output directories:
  dist/gemini/   - Gemini CLI extension
  dist/claude/   - Claude Code plugin
  dist/augment/  - Augment Code commands
```

**Step 4: Spot-check a generated file**

```bash
# Check that a Claude skill file exists and has the right format
node -e "const s = require('fs').readFileSync('dist/claude/skills/setup/SKILL.md','utf8'); console.log(s.slice(0,200))"
```
Expected: starts with `---\nname: setup\ndescription:`

**Step 5: Check template path injection**

```bash
node -e "
const s = require('fs').readFileSync('dist/claude/skills/setup/SKILL.md','utf8');
const hasFind = s.includes('find ~');
const hasPwsh = s.includes('Get-ChildItem');
// On Mac/Linux, should have find; on Windows, should have Get-ChildItem
console.log('has find:', hasFind, '| has Get-ChildItem:', hasPwsh);
"
```
Expected on Mac/Linux: `has find: true | has Get-ChildItem: false`

**Step 6: Commit**

```bash
git add build.js
git commit -m "feat: add cross-platform Node.js build script"
```

---

### Task 4: Create `install-claude.js`

**Files:**
- Create: `install-claude.js`

**Step 1: Write `install-claude.js`**

```js
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT_DIR      = __dirname;
const DIST_CLAUDE     = path.join(SCRIPT_DIR, 'dist', 'claude');
const MARKETPLACE_DIR = path.join(SCRIPT_DIR, 'dist', 'claude-marketplace');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.error) throw result.error;
  return result;
}

function main() {
  // Verify build output exists
  const pluginManifest = path.join(DIST_CLAUDE, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pluginManifest)) {
    console.error('Error: dist/claude/.claude-plugin/plugin.json not found. Run `node build.js` first.');
    process.exit(1);
  }

  const version = JSON.parse(fs.readFileSync(pluginManifest, 'utf8')).version;

  console.log('=== Conductor Claude Code Installer ===');
  console.log(`Version: ${version}`);
  console.log('');

  // Create marketplace directory structure
  fs.mkdirSync(path.join(MARKETPLACE_DIR, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(MARKETPLACE_DIR, 'plugins'), { recursive: true });

  // Write marketplace manifest
  const marketplace = {
    name: 'conductor-local',
    description: 'Local marketplace for the Conductor plugin',
    owner: { name: 'EventsAir' },
    plugins: [{
      name: 'conductor',
      description: 'Conductor: AI-driven spec-based development framework for managing tracks, specs, and plans',
      version,
      source: './plugins/conductor',
      category: 'development',
    }],
  };
  fs.writeFileSync(
    path.join(MARKETPLACE_DIR, '.claude-plugin', 'marketplace.json'),
    JSON.stringify(marketplace, null, 2),
  );

  // Copy plugin files into marketplace (no symlinks — avoids Windows admin requirement)
  const pluginDest = path.join(MARKETPLACE_DIR, 'plugins', 'conductor');
  if (fs.existsSync(pluginDest)) {
    fs.rmSync(pluginDest, { recursive: true, force: true });
  }
  fs.cpSync(DIST_CLAUDE, pluginDest, { recursive: true });

  // Remove existing registrations (ignore errors — they may not exist)
  run('claude', ['plugin', 'marketplace', 'remove', 'conductor-local'], { stdio: 'pipe' });
  run('claude', ['plugin', 'uninstall', 'conductor@conductor-local'], { stdio: 'pipe' });

  // Register and install
  console.log('Registering local marketplace...');
  run('claude', ['plugin', 'marketplace', 'add', MARKETPLACE_DIR]);

  console.log('');
  console.log('Installing conductor plugin...');
  run('claude', ['plugin', 'install', 'conductor@conductor-local']);

  console.log('');
  console.log('=== Installation Complete ===');
  console.log('Restart Claude Code to load the plugin.');
  console.log('Available commands: /conductor:setup, /conductor:newTrack, /conductor:implement, /conductor:status, /conductor:review, /conductor:revert');
}

main();
```

**Step 2: Verify the script parses without errors**

```bash
node --check install-claude.js
```
Expected: no output (no syntax errors)

**Step 3: Do a dry-run check (build must already have run)**

Verify it exits with a clear error if `dist/` doesn't exist:
```bash
node -e "
const fs = require('fs');
if (fs.existsSync('dist/claude')) {
  fs.rmSync('dist/claude', {recursive:true, force:true});
}
" && node install-claude.js
```
Expected: `Error: dist/claude/.claude-plugin/plugin.json not found. Run \`node build.js\` first.`

Restore dist:
```bash
node build.js
```

**Step 4: Commit**

```bash
git add install-claude.js
git commit -m "feat: add cross-platform Claude Code install script"
```

---

### Task 5: Create `install-augment.js`

**Files:**
- Create: `install-augment.js`

**Step 1: Write `install-augment.js`**

```js
'use strict';
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR   = __dirname;
const DIST_AUGMENT = path.join(SCRIPT_DIR, 'dist', 'augment');

function main() {
  const targetArg = process.argv[2];
  if (!targetArg) {
    console.error('Usage: node install-augment.js <target-project-path>');
    console.error('Example: node install-augment.js /path/to/your/project');
    process.exit(1);
  }

  const targetDir = path.resolve(targetArg);
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: target directory does not exist: ${targetDir}`);
    process.exit(1);
  }

  if (!fs.statSync(targetDir).isDirectory()) {
    console.error(`Error: target path is not a directory: ${targetDir}`);
    process.exit(1);
  }

  // Verify build output exists
  if (!fs.existsSync(DIST_AUGMENT)) {
    console.error('Error: dist/augment/ not found. Run `node build.js` first.');
    process.exit(1);
  }

  console.log('=== Conductor Augment Code Installer ===');
  console.log(`Target: ${targetDir}`);
  console.log('');

  // Copy .augment/ commands
  const srcAugment  = path.join(DIST_AUGMENT, '.augment');
  const destAugment = path.join(targetDir, '.augment');
  console.log(`Copying .augment/ → ${destAugment}`);
  fs.cpSync(srcAugment, destAugment, { recursive: true });

  // Copy CLAUDE.md
  const destClaude = path.join(targetDir, 'CLAUDE.md');
  console.log(`Copying CLAUDE.md → ${destClaude}`);
  fs.copyFileSync(path.join(DIST_AUGMENT, 'CLAUDE.md'), destClaude);

  // Copy templates into .augment/
  const destTemplates = path.join(targetDir, '.augment', 'templates');
  console.log(`Copying templates → ${destTemplates}`);
  fs.cpSync(path.join(DIST_AUGMENT, 'templates'), destTemplates, { recursive: true });

  console.log('');
  console.log('=== Installation Complete ===');
  console.log('Conductor commands are available in Augment Code:');
  console.log('  /conductor:setup, /conductor:newTrack, /conductor:implement,');
  console.log('  /conductor:status, /conductor:review, /conductor:revert');
}

main();
```

**Step 2: Verify syntax**

```bash
node --check install-augment.js
```
Expected: no output

**Step 3: Test with missing target argument**

```bash
node install-augment.js
```
Expected: `Usage: node install-augment.js <target-project-path>`

**Step 4: Test with a temp directory (build must have run)**

```bash
mkdir -p /tmp/conductor-test-project
node install-augment.js /tmp/conductor-test-project
ls /tmp/conductor-test-project/.augment/commands/conductor/
```
Expected: lists `setup.md`, `newTrack.md`, `implement.md`, `status.md`, `review.md`, `revert.md`

**Step 5: Commit**

```bash
git add install-augment.js
git commit -m "feat: add cross-platform Augment Code install script"
```

---

### Task 6: Update `README.md`

Read `README.md` in full before editing. The Installation section starts at line 32.

**Files:**
- Modify: `README.md` — Installation section only

**Step 1: Replace the Installation section**

Replace the entire `## Installation` section with the following. Keep everything above (Supported Platforms, Features) and below (Usage) unchanged.

```markdown
## Installation

> **Prerequisite:** [Node.js 18+](https://nodejs.org) must be installed on your machine.

### Gemini CLI

The Gemini CLI extension is installed directly — no build step required.

```bash
gemini extensions install https://github.com/eventsair/conductor --auto-update
```

The `--auto-update` flag is optional: if specified, it will update to new versions as they are released.

---

### Claude Code

#### Mac / Linux

1. Clone and build:
   ```bash
   git clone https://github.com/eventsair/conductor.git
   cd conductor
   node build.js
   ```
2. Install the plugin:
   ```bash
   node install-claude.js
   ```
3. Restart Claude Code to load the plugin.

> **Note:** The install script registers a local marketplace and installs the plugin via `claude plugin install`. Simply copying files to `~/.claude/plugins/` is not sufficient — plugins must be registered through the marketplace system to be loaded by Claude Code.

#### Windows

Same steps as Mac / Linux. Run in PowerShell or Command Prompt:

```powershell
git clone https://github.com/eventsair/conductor.git
cd conductor
node build.js
node install-claude.js
```

Restart Claude Code to load the plugin.

---

### Augment Code

#### Mac / Linux

1. Build:
   ```bash
   git clone https://github.com/eventsair/conductor.git
   cd conductor
   node build.js
   ```
2. Install into your project:
   ```bash
   node install-augment.js /path/to/your/project
   ```

#### Windows

```powershell
git clone https://github.com/eventsair/conductor.git
cd conductor
node build.js
node install-augment.js C:\path\to\your\project
```
```

**Step 2: Verify the file looks correct**

```bash
node -e "
const s = require('fs').readFileSync('README.md','utf8');
console.log('Has Windows section:', s.includes('#### Windows'));
console.log('Has node build.js:', s.includes('node build.js'));
console.log('Has install-augment:', s.includes('install-augment.js'));
"
```
Expected: all three `true`

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Windows installation instructions and restructure README sections"
```

---

### Task 7: Delete bash scripts and final verification

**Files:**
- Delete: `build.sh`
- Delete: `install-claude.sh`

**Step 1: Delete the bash scripts**

```bash
git rm build.sh install-claude.sh
```

**Step 2: Verify nothing references the deleted files**

```bash
node -e "
const fs = require('fs');
const readme = fs.readFileSync('README.md', 'utf8');
console.log('build.sh in README:', readme.includes('build.sh'));
console.log('install-claude.sh in README:', readme.includes('install-claude.sh'));
"
```
Expected: both `false`

**Step 3: Run full build one final time to confirm everything works**

```bash
node build.js
```
Expected: clean output ending with `=== Build Complete ===`

**Step 4: Run unit tests one final time**

```bash
node build.test.js
```
Expected: `All tests passed.`

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove bash scripts replaced by cross-platform Node.js scripts"
```

---

## Verification Checklist

- [ ] `node build.test.js` → `All tests passed.`
- [ ] `node build.js` → generates `dist/gemini/`, `dist/claude/`, `dist/augment/`
- [ ] `dist/claude/skills/setup/SKILL.md` exists and has `---\nname: setup` header
- [ ] On Mac/Linux: `dist/claude/skills/setup/SKILL.md` contains `find ~`
- [ ] `node install-claude.js` (with Claude Code installed) → installs plugin, commands available
- [ ] `node install-augment.js /tmp/test` → copies files correctly
- [ ] `README.md` has `#### Windows` under both Claude Code and Augment Code sections
- [ ] `build.sh` and `install-claude.sh` are deleted
