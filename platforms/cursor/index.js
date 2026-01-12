/**
 * Cursor platform adapter.
 * Transforms Claude Code format to Cursor-compatible format.
 */
const {
  AdapterBase,
  parseFrontmatter,
  reconstructMarkdown,
} = require('../adapter-base');

class CursorAdapter extends AdapterBase {
  get id() {
    return 'cursor';
  }

  get displayName() {
    return 'Cursor';
  }

  get dirName() {
    return '.cursor';
  }

  /**
   * Cursor uses "/" as command separator (gsd/help instead of gsd:help)
   */
  get commandSeparator() {
    return '/';
  }

  /**
   * Override transformContent to add command reference transformation
   */
  transformContent(content, pathPrefix) {
    let result = content;

    // Replace source path references with target platform paths
    result = result.replace(/~\/\.claude\//g, pathPrefix);

    // Apply platform-specific transformations
    result = this.transformFrontmatter(result);
    result = this.transformFileReferences(result, pathPrefix);
    result = this.transformCommandReferences(result);

    return result;
  }

  /**
   * Transform frontmatter for Cursor compatibility:
   * - Remove 'allowed-tools' (not supported)
   * - Move 'argument-hint' into description
   * - Transform command name from gsd:xxx to gsd/xxx
   */
  transformFrontmatter(content) {
    const { frontmatter, body, raw } = parseFrontmatter(content);

    if (!frontmatter) {
      return content;
    }

    // Remove unsupported fields
    delete frontmatter['allowed-tools'];

    // Transform command name: gsd:xxx → gsd/xxx
    if (frontmatter.name && frontmatter.name.includes(':')) {
      frontmatter.name = frontmatter.name.replace(/:/g, '/');
    }

    // Append argument-hint to description if present
    if (frontmatter['argument-hint']) {
      const hint = frontmatter['argument-hint'];
      const desc = frontmatter.description || '';
      frontmatter.description = desc
        ? `${desc} Arguments: ${hint}`
        : `Arguments: ${hint}`;
      delete frontmatter['argument-hint'];
    }

    return reconstructMarkdown(frontmatter, body);
  }

  /**
   * Transform command references in content.
   * Cursor uses gsd/command format, not gsd:command
   *
   * Pattern: /gsd:xxx → /gsd/xxx
   */
  transformCommandReferences(content) {
    const sep = this.commandSeparator;
    // Transform /gsd:command → /gsd/command (or whatever separator this platform uses)
    return content.replace(/\/gsd:([a-z-]+)/g, `/gsd${sep}$1`);
  }

  /**
   * Transform @file references for Cursor.
   * Cursor doesn't expand @file in commands - convert to explicit read instructions.
   *
   * Pattern: @path/to/file → "Read: path/to/file"
   */
  transformFileReferences(content, pathPrefix) {
    // Find all @file references (lines starting with @ followed by a path)
    // Matches: @path/file.md, @.planning/config.json, etc.
    const atFilePattern = /^(@[^\s]+)$/gm;

    // Collect all @file references
    const refs = [];
    let match;
    while ((match = atFilePattern.exec(content)) !== null) {
      refs.push(match[1]);
    }

    if (refs.length === 0) {
      return content;
    }

    // Group consecutive @file references and transform them as blocks
    let result = content;
    let processedRefs = new Set();

    // Find blocks of consecutive @file references
    const lines = content.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // Check if this line is an @file reference
      if (line.startsWith('@') && !line.includes(' ') && line.length > 1) {
        // Found start of a block, collect consecutive refs
        const blockRefs = [];
        const blockStartIndex = i;

        while (i < lines.length) {
          const currentLine = lines[i].trim();
          if (currentLine.startsWith('@') && !currentLine.includes(' ') && currentLine.length > 1) {
            blockRefs.push(currentLine);
            i++;
          } else {
            break;
          }
        }

        // Transform this block
        if (blockRefs.length > 0) {
          const fileList = blockRefs
            .map((ref) => `- ${ref.slice(1)}`) // Remove @ prefix
            .join('\n');

          const readInstructions = `**Read these files before proceeding:**\n${fileList}`;

          // Replace the block in result
          const blockPattern = blockRefs.map(r => escapeRegex(r)).join('\\n');
          result = result.replace(new RegExp(blockPattern), readInstructions);
        }
      } else {
        i++;
      }
    }

    return result;
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

  /**
   * Get Cursor-specific additional files (subagents)
   */
CursorAdapter.prototype.getAdditionalFiles = function() {
  const fs = require('fs');
  const path = require('path');

  const agentsDir = path.join(__dirname, 'agents');
  const files = [];

  // Only include agents if the directory exists
  if (fs.existsSync(agentsDir)) {
    const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));

    for (const agentFile of agentFiles) {
      const content = fs.readFileSync(path.join(agentsDir, agentFile), 'utf8');
      files.push({
        dest: `agents/${agentFile}`,
        content: content,
      });
    }
  }

  return files;
};

module.exports = CursorAdapter;
