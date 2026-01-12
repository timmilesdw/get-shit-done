/**
 * Base adapter class for platform-specific transformations.
 * Extend this class to add support for new AI coding platforms.
 */
class AdapterBase {
  constructor(options = {}) {
    this.isGlobal = options.isGlobal ?? true;
    this.configDir = options.configDir ?? null;
  }

  /**
   * Platform identifier (e.g., 'claude', 'cursor')
   * @returns {string}
   */
  get id() {
    throw new Error('Subclass must implement id getter');
  }

  /**
   * Display name for the platform
   * @returns {string}
   */
  get displayName() {
    throw new Error('Subclass must implement displayName getter');
  }

  /**
   * Directory name for this platform (e.g., '.claude', '.cursor')
   * @returns {string}
   */
  get dirName() {
    throw new Error('Subclass must implement dirName getter');
  }

  /**
   * Get the target installation directory
   * @param {string} cwd - Current working directory (for local installs)
   * @param {string} homeDir - User's home directory
   * @returns {string}
   */
  getTargetDir(cwd, homeDir) {
    if (this.configDir) {
      return this.configDir;
    }
    return this.isGlobal
      ? `${homeDir}/${this.dirName}`
      : `${cwd}/${this.dirName}`;
  }

  /**
   * Get the path prefix for file references in markdown files
   * @returns {string}
   */
  getPathPrefix() {
    if (this.configDir) {
      return `${this.configDir}/`;
    }
    return this.isGlobal
      ? `~/${this.dirName}/`
      : `./${this.dirName}/`;
  }

  /**
   * Transform markdown file content for this platform
   * @param {string} content - Original file content
   * @param {string} pathPrefix - Path prefix to use
   * @returns {string}
   */
  transformContent(content, pathPrefix) {
    let result = content;

    // Replace source path references with target platform paths
    result = result.replace(/~\/\.claude\//g, pathPrefix);

    // Apply platform-specific transformations
    result = this.transformFrontmatter(result);
    result = this.transformFileReferences(result, pathPrefix);

    return result;
  }

  /**
   * Transform YAML frontmatter for this platform
   * Override in subclass if platform needs different frontmatter
   * @param {string} content
   * @returns {string}
   */
  transformFrontmatter(content) {
    return content;
  }

  /**
   * Transform @file references for this platform
   * Override in subclass if platform handles file refs differently
   * @param {string} content
   * @param {string} pathPrefix
   * @returns {string}
   */
  transformFileReferences(content, pathPrefix) {
    return content;
  }

  /**
   * Get additional files to install (platform-specific)
   * Override in subclass to add agents, rules, etc.
   * @returns {Array<{src: string, dest: string, content?: string}>}
   */
  getAdditionalFiles() {
    return [];
  }

  /**
   * Validate that the platform is available/installed
   * @param {string} homeDir
   * @returns {{valid: boolean, message?: string}}
   */
  validate(homeDir) {
    return { valid: true };
  }
}

/**
 * Parse YAML frontmatter from markdown content
 * @param {string} content
 * @returns {{frontmatter: object|null, body: string, raw: string|null}}
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: null, body: content, raw: null };
  }

  const raw = match[1];
  const body = match[2];

  // Simple YAML parsing for frontmatter
  const frontmatter = {};
  const lines = raw.split('\n');
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Array item
    if (trimmed.startsWith('- ') && currentKey) {
      if (!currentArray) {
        currentArray = [];
        frontmatter[currentKey] = currentArray;
      }
      currentArray.push(trimmed.slice(2).trim());
      continue;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w[\w-]*):(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();
      currentArray = null;

      if (value) {
        frontmatter[currentKey] = value;
      }
    }
  }

  return { frontmatter, body, raw };
}

/**
 * Serialize frontmatter back to YAML string
 * @param {object} frontmatter
 * @returns {string}
 */
function serializeFrontmatter(frontmatter) {
  const lines = [];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Reconstruct markdown with modified frontmatter
 * @param {object} frontmatter
 * @param {string} body
 * @returns {string}
 */
function reconstructMarkdown(frontmatter, body) {
  const yaml = serializeFrontmatter(frontmatter);
  return `---\n${yaml}\n---\n${body}`;
}

module.exports = {
  AdapterBase,
  parseFrontmatter,
  serializeFrontmatter,
  reconstructMarkdown,
};
