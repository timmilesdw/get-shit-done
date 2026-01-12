#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Get version from package.json
const pkg = require('../package.json');

const banner = `
${cyan}   ██████╗ ███████╗██████╗
  ██╔════╝ ██╔════╝██╔══██╗
  ██║  ███╗███████╗██║  ██║
  ██║   ██║╚════██║██║  ██║
  ╚██████╔╝███████║██████╔╝
   ╚═════╝ ╚══════╝╚═════╝${reset}

  Get Shit Done ${dim}v${pkg.version}${reset}
  A meta-prompting, context engineering and spec-driven
  development system for AI coding agents by TÂCHES.
`;

// Platform registry
const PLATFORMS = {
  claude: {
    adapter: '../platforms/claude-code',
    displayName: 'Claude Code',
  },
  cursor: {
    adapter: '../platforms/cursor',
    displayName: 'Cursor',
  },
};

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasHelp = args.includes('--help') || args.includes('-h');

/**
 * Parse --ai argument
 */
function parseAiArg() {
  const aiIndex = args.findIndex((arg) => arg === '--ai');
  if (aiIndex !== -1) {
    const nextArg = args[aiIndex + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--ai requires a platform name (${Object.keys(PLATFORMS).join(' | ')})${reset}`);
      process.exit(1);
    }
    return nextArg.toLowerCase();
  }
  // Also handle --ai=value format
  const aiArg = args.find((arg) => arg.startsWith('--ai='));
  if (aiArg) {
    return aiArg.split('=')[1].toLowerCase();
  }
  return 'claude'; // Default
}

/**
 * Parse --config-dir argument
 */
function parseConfigDirArg() {
  const configDirIndex = args.findIndex((arg) => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  // Also handle --config-dir=value format
  const configDirArg = args.find((arg) => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (configDirArg) {
    return configDirArg.split('=')[1];
  }
  return null;
}

const selectedPlatform = parseAiArg();
const explicitConfigDir = parseConfigDirArg();

console.log(banner);

// Validate platform
if (!PLATFORMS[selectedPlatform]) {
  console.error(`  ${yellow}Unknown platform: ${selectedPlatform}${reset}`);
  console.error(`  ${dim}Available: ${Object.keys(PLATFORMS).join(', ')}${reset}`);
  process.exit(1);
}

// Show help if requested
if (hasHelp) {
  const platformList = Object.entries(PLATFORMS)
    .map(([id, p]) => `${id} (${p.displayName})`)
    .join(', ');

  console.log(`  ${yellow}Usage:${reset} npx get-shit-done-cc [options]

  ${yellow}Options:${reset}
    ${cyan}--ai <platform>${reset}          Target AI platform: ${Object.keys(PLATFORMS).join(' | ')} (default: claude)
    ${cyan}-g, --global${reset}              Install globally (to platform config directory)
    ${cyan}-l, --local${reset}               Install locally (to ./.<platform> in current directory)
    ${cyan}-c, --config-dir <path>${reset}   Specify custom config directory
    ${cyan}-h, --help${reset}                Show this help message

  ${yellow}Platforms:${reset}
    ${platformList}

  ${yellow}Examples:${reset}
    ${dim}# Install for Claude Code (default) to ~/.claude/${reset}
    npx get-shit-done-cc --global

    ${dim}# Install for Cursor globally to ~/.cursor/${reset}
    npx get-shit-done-cc --ai cursor --global

    ${dim}# Install for Cursor in current project${reset}
    npx get-shit-done-cc --ai cursor --local

    ${dim}# Install to custom config directory${reset}
    npx get-shit-done-cc --global --config-dir ~/.claude-bc

    ${dim}# Using environment variable${reset}
    CLAUDE_CONFIG_DIR=~/.claude-bc npx get-shit-done-cc --global

  ${yellow}Notes:${reset}
    The --config-dir option is useful when you have multiple configurations.
    It takes priority over environment variables.
`);
  process.exit(0);
}

/**
 * Expand ~ to home directory
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Load platform adapter
 */
function loadAdapter(platformId, options) {
  const platform = PLATFORMS[platformId];
  const AdapterClass = require(platform.adapter);
  return new AdapterClass(options);
}

/**
 * Recursively copy directory, applying adapter transformations to .md files
 */
function copyWithTransformation(srcDir, destDir, adapter, pathPrefix) {
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithTransformation(srcPath, destPath, adapter, pathPrefix);
    } else if (entry.name.endsWith('.md')) {
      let content = fs.readFileSync(srcPath, 'utf8');
      content = adapter.transformContent(content, pathPrefix);
      fs.writeFileSync(destPath, content);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Install to the specified directory
 */
function install(isGlobal) {
  const src = path.join(__dirname, '..');

  // Load adapter with options
  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const adapter = loadAdapter(selectedPlatform, {
    isGlobal,
    configDir,
  });

  // Determine target directory
  const targetDir = adapter.getTargetDir(process.cwd(), os.homedir());
  const pathPrefix = adapter.getPathPrefix();

  const locationLabel = isGlobal
    ? targetDir.replace(os.homedir(), '~')
    : targetDir.replace(process.cwd(), '.');

  console.log(`  Platform: ${cyan}${adapter.displayName}${reset}`);
  console.log(`  Installing to ${cyan}${locationLabel}${reset}\n`);

  // Create commands directory
  const commandsDir = path.join(targetDir, 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });

  // Copy commands/gsd with transformation
  const gsdSrc = path.join(src, 'commands', 'gsd');
  const gsdDest = path.join(commandsDir, 'gsd');
  copyWithTransformation(gsdSrc, gsdDest, adapter, pathPrefix);
  console.log(`  ${green}✓${reset} Installed commands/gsd`);

  // Copy get-shit-done skill with transformation
  const skillSrc = path.join(src, 'get-shit-done');
  const skillDest = path.join(targetDir, 'get-shit-done');
  copyWithTransformation(skillSrc, skillDest, adapter, pathPrefix);
  console.log(`  ${green}✓${reset} Installed get-shit-done`);

  // Install additional platform-specific files
  const additionalFiles = adapter.getAdditionalFiles();
  for (const file of additionalFiles) {
    const destPath = path.join(targetDir, file.dest);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    if (file.content) {
      fs.writeFileSync(destPath, file.content);
    } else if (file.src) {
      const srcPath = path.join(src, file.src);
      fs.copyFileSync(srcPath, destPath);
    }
    console.log(`  ${green}✓${reset} Installed ${file.dest}`);
  }

  console.log(`
  ${green}Done!${reset} Run ${cyan}/gsd:help${reset} to get started.
`);
}

/**
 * Prompt for install location
 */
function promptLocation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const adapter = loadAdapter(selectedPlatform, { isGlobal: true });
  const globalPath = adapter.getTargetDir(process.cwd(), os.homedir());
  const globalLabel = globalPath.replace(os.homedir(), '~');

  const localAdapter = loadAdapter(selectedPlatform, { isGlobal: false });
  const localPath = localAdapter.getTargetDir(process.cwd(), os.homedir());
  const localLabel = localPath.replace(process.cwd(), '.');

  console.log(`  Platform: ${cyan}${adapter.displayName}${reset}

  ${yellow}Where would you like to install?${reset}

  ${cyan}1${reset}) Global ${dim}(${globalLabel})${reset} - available in all projects
  ${cyan}2${reset}) Local  ${dim}(${localLabel})${reset} - this project only
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    const isGlobal = choice !== '2';
    install(isGlobal);
  });
}

// Main
if (hasGlobal && hasLocal) {
  console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
  process.exit(1);
} else if (explicitConfigDir && hasLocal) {
  console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);
  process.exit(1);
} else if (hasGlobal) {
  install(true);
} else if (hasLocal) {
  install(false);
} else {
  promptLocation();
}
