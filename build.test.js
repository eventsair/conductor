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
