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
