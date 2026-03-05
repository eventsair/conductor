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
