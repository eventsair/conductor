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
