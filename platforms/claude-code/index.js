/**
 * Claude Code platform adapter.
 * This is the "native" format - minimal transformations needed.
 */
const { AdapterBase } = require('../adapter-base');

class ClaudeCodeAdapter extends AdapterBase {
  get id() {
    return 'claude';
  }

  get displayName() {
    return 'Claude Code';
  }

  get dirName() {
    return '.claude';
  }

  /**
   * Claude Code is the source format, so frontmatter passes through unchanged
   */
  transformFrontmatter(content) {
    return content;
  }

  /**
   * Claude Code supports @file syntax natively, no transformation needed
   */
  transformFileReferences(content, pathPrefix) {
    return content;
  }
}

module.exports = ClaudeCodeAdapter;
