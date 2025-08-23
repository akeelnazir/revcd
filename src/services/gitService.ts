import { exec } from 'child_process';
import { promisify } from 'util';
import { CODE_REVIEW_CONFIG } from '../config';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Service for Git operations
 */
export class GitService {
  /**
   * Execute a git command and return the result
   * @param command Git command to execute
   * @returns Promise with the command output
   */
  public static async execGitCommand(command: string): Promise<{stdout: string, stderr: string}> {
    return execAsync(command);
  }

  /**
   * Checks if the current directory is a git repository
   * @returns Promise<boolean> indicating if current directory is a git repository
   */
  public static async isGitRepository(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets all uncommitted changes in the repository
   * @returns Promise with the uncommitted changes or null if error
   */
  public static async getUncommittedChanges(): Promise<string | null> {
    try {
      // Check if we're in a git repository
      if (!(await this.isGitRepository())) {
        return null;
      }
      
      // Get staged changes
      const { stdout: stagedChanges } = await execAsync('git diff --name-status --staged');
      
      // Get unstaged changes
      const { stdout: unstagedChanges } = await execAsync('git diff --name-status');
      
      // Get untracked files
      const { stdout: untrackedFiles } = await execAsync('git ls-files --others --exclude-standard');
      
      let result = '';
      
      if (stagedChanges.trim()) {
        result += '# Staged Changes:\n' + stagedChanges;
      }
      
      if (unstagedChanges.trim()) {
        if (result) result += '\n';
        result += '# Unstaged Changes:\n' + unstagedChanges;
      }
      
      if (untrackedFiles.trim()) {
        if (result) result += '\n';
        result += '# Untracked Files:\n' + untrackedFiles.split('\n').map(file => `? ${file}`).join('\n');
      }
      
      return result.trim() || "No uncommitted changes";
    } catch (error) {
      console.error('Error getting uncommitted git changes:', error);
      return null;
    }
  }

  /**
   * Gets the latest commit changes
   * @returns Promise with the latest commit changes or null if error
   */
  public static async getLatestCommitChanges(): Promise<string[] | null> {
    try {
      // Check if we're in a git repository
      if (!(await this.isGitRepository())) {
        return null;
      }
      
      // Get the list of files changed in the latest commit
      const { stdout: changedFiles } = await execAsync('git diff-tree --no-commit-id --name-only -r HEAD');
      
      if (!changedFiles.trim()) {
        return [];
      }
      
      return changedFiles.trim().split('\n');
    } catch (error) {
      console.error('Error getting latest commit changes:', error);
      return null;
    }
  }

  // Cache for file contents to avoid repeated git operations on the same file
  private static fileContentCache = new Map<string, string>();

  /**
   * Gets the content of a file from the latest commit or from disk if not committed
   * @param filePath Path to the file
   * @param useCache Whether to use the cache (default: true)
   * @returns Promise with the file content or null if error
   */
  public static async getFileFromLatestCommit(filePath: string, useCache: boolean = true): Promise<string | null> {
    try {
      // Check if we're in a git repository
      if (!(await this.isGitRepository())) {
        return null;
      }

      // Check cache first if enabled
      const cacheKey = `HEAD:${filePath}`;
      if (useCache && this.fileContentCache.has(cacheKey)) {
        return this.fileContentCache.get(cacheKey) || null;
      }
      
      try {
        // Try to get the content of the file from the latest commit
        // Using git show HEAD:<filePath> directly is more efficient
        const { stdout: fileContent } = await execAsync(`git show HEAD:${filePath}`);
        
        // Cache the result for future use
        if (useCache) {
          this.fileContentCache.set(cacheKey, fileContent);
        }
        
        return fileContent;
      } catch (commitError) {
        // If the file doesn't exist in HEAD, check if it exists on disk
        try {
          // More efficient check for file existence
          const { stdout: fileExists } = await execAsync(`[ -f "${filePath}" ] && echo "exists" || echo ""`);
          
          if (fileExists.trim() === 'exists') {
            // File exists on disk but not in HEAD, read it directly
            const { stdout: diskContent } = await execAsync(`cat "${filePath}"`);
            
            // Don't cache disk content with the HEAD key since it's not from HEAD
            
            return diskContent;
          } else {
            // File doesn't exist in HEAD or on disk
            return null;
          }
        } catch (diskError) {
          // Error checking file on disk
          return null;
        }
      }
    } catch (error) {
      console.error(`Error getting file content for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Checks if a file should be included in code review based on its extension
   * @param filePath Path to the file
   * @returns boolean indicating if the file should be included
   */
  private static shouldIncludeFile(filePath: string): boolean {
    // Get the file extension without the dot
    const extension = path.extname(filePath).slice(1).toLowerCase();
    
    // If no extension, exclude the file
    if (!extension) return false;
    
    // Check if the extension is in the allowed list
    return CODE_REVIEW_CONFIG.FILE_EXTENSIONS.includes(extension);
  }

  // Cache for uncommitted file contents to avoid repeated file reads
  private static uncommittedFileCache = new Map<string, string>();

  /**
   * Gets all uncommitted files with their content
   * @param filterByExtension Whether to filter files by extension (default: true)
   * @param useCache Whether to use the cache (default: true)
   * @returns Promise with map of file paths to their content or null if error
   */
  public static async getUncommittedFilesContent(filterByExtension: boolean = true, useCache: boolean = true): Promise<Map<string, string> | null> {
    try {
      // Check if we're in a git repository
      if (!(await this.isGitRepository())) {
        return null;
      }
      
      const fileContents = new Map<string, string>();
      
      // Use more efficient git commands to get modified files
      // Get modified tracked files (both staged and unstaged)
      const { stdout: modifiedFiles } = await execAsync('git ls-files --modified');
      
      // Get staged files (including new files staged for commit)
      const { stdout: stagedFiles } = await execAsync('git diff --name-only --cached');
      
      // Get untracked files
      const { stdout: untrackedFiles } = await execAsync('git ls-files --others --exclude-standard');
      
      // Process all file paths using a Set for efficient tracking of unique files
      const allFiles = new Set<string>(
        [...modifiedFiles.trim().split('\n'), 
         ...stagedFiles.trim().split('\n'),
         ...untrackedFiles.trim().split('\n')]
        .filter(file => file.trim() !== '')
      );
      
      // Filter files by extension if requested
      const filesToProcess = filterByExtension ? 
        Array.from(allFiles).filter(file => this.shouldIncludeFile(file)) : 
        Array.from(allFiles);
      
      // Get content for each file with caching
      for (const filePath of filesToProcess) {
        try {
          // Check cache first if enabled
          const cacheKey = `uncommitted:${filePath}`;
          if (useCache && this.uncommittedFileCache.has(cacheKey)) {
            fileContents.set(filePath, this.uncommittedFileCache.get(cacheKey) || '');
            continue;
          }
          
          // For uncommitted files, get the current content
          const { stdout: fileContent } = await execAsync(`cat "${filePath}"`);
          
          // Cache the result if caching is enabled
          if (useCache) {
            this.uncommittedFileCache.set(cacheKey, fileContent);
          }
          
          fileContents.set(filePath, fileContent);
        } catch (error) {
          console.error(`Error reading file ${filePath}:`, error);
        }
      }
      
      return fileContents;
    } catch (error) {
      console.error('Error getting uncommitted files content:', error);
      return null;
    }
  }

  /**
   * Gets all changed files with their content from the latest commit
   * @param useCache Whether to use the cache (default: true)
   * @returns Promise with map of file paths to their content or null if error
   */
  public static async getChangedFilesContent(useCache: boolean = true): Promise<Map<string, string> | null> {
    try {
      // Check if we're in a git repository
      if (!(await this.isGitRepository())) {
        return null;
      }
      
      // Get the list of files changed in the latest commit directly
      // This is more efficient than calling getLatestCommitChanges() which does the same thing
      const { stdout: changedFilesOutput } = await execAsync('git diff-tree --no-commit-id --name-only -r HEAD');
      
      if (!changedFilesOutput.trim()) {
        return new Map();
      }
      
      // Use a Set for efficient tracking of unique file paths
      const changedFilesSet = new Set<string>(changedFilesOutput.trim().split('\n'));
      const fileContents = new Map<string, string>();
      
      // Process files from the latest commit using the improved getFileFromLatestCommit with caching
      for (const filePath of changedFilesSet) {
        const content = await this.getFileFromLatestCommit(filePath, useCache);
        if (content !== null) {
          fileContents.set(filePath, content);
        } else {
          // If the file doesn't exist in HEAD or on disk, mark it as deleted
          fileContents.set(filePath, '(File was deleted in this commit)');
        }
      }
      
      return fileContents;
    } catch (error) {
      console.error('Error getting changed files content:', error);
      return null;
    }
  }
  
  /**
   * Gets the content of a specific file, whether it's committed or not
   * @param filePath Path to the file
   * @param useCache Whether to use the cache (default: true)
   * @returns Promise with the file content or null if error
   */
  public static async getFileContent(filePath: string, useCache: boolean = true): Promise<string | null> {
    // First try to get from latest commit
    const commitContent = await this.getFileFromLatestCommit(filePath, useCache);
    if (commitContent !== null) {
      return commitContent;
    }
    
    // If not in commit, try to get from disk
    try {
      const { stdout: fileExists } = await execAsync(`[ -f "${filePath}" ] && echo "exists" || echo ""`);
      
      if (fileExists.trim() === 'exists') {
        const { stdout: diskContent } = await execAsync(`cat "${filePath}"`);
        return diskContent;
      }
    } catch (error) {
      console.error(`Error reading file ${filePath} from disk:`, error);
    }
    
    return null;
  }

  /**
   * Gets the hunks (changed parts) of unstaged/uncommitted files
   * @param filePath Optional path to a specific file to get hunks for. If not provided, gets hunks for all unstaged files.
   * @returns Promise with a map of file paths to their hunks or null if error
   */
  public static async getUncommittedHunks(filePath?: string): Promise<Map<string, string[]> | null> {
    try {
      // Check if we're in a git repository
      if (!(await this.isGitRepository())) {
        return null;
      }

      const hunksMap = new Map<string, string[]>();
      
      // Command to get unstaged changes with patch information
      const diffCommand = filePath 
        ? `git diff -- "${filePath}"` 
        : 'git diff';
      
      const { stdout: diffOutput } = await execAsync(diffCommand);
      
      if (!diffOutput.trim()) {
        return hunksMap; // No changes
      }

      // Process the diff output to extract hunks by file
      let currentFile: string | null = null;
      let currentHunk: string[] = [];
      
      const lines = diffOutput.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for file header (diff --git a/file b/file)
        if (line.startsWith('diff --git')) {
          // Save previous file's hunks if any
          if (currentFile && currentHunk.length > 0) {
            hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
            currentHunk = [];
          }
          
          // Extract new filename from the line
          // Format: diff --git a/path/to/file b/path/to/file
          const match = line.match(/diff --git a\/(.+) b\/.+/);
          currentFile = match ? match[1] : null;
        } 
        // Check for hunk header (@@ -start,lines +start,lines @@)
        else if (line.startsWith('@@') && line.includes('@@')) {
          // Save previous hunk if any
          if (currentHunk.length > 0 && currentFile) {
            hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
            currentHunk = [];
          }
          
          // Start a new hunk
          currentHunk.push(line);
        } 
        // Add line to current hunk
        else if (currentFile && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
          currentHunk.push(line);
        }
      }
      
      // Save the last hunk if any
      if (currentFile && currentHunk.length > 0) {
        hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
      }
      
      return hunksMap;
    } catch (error) {
      console.error('Error getting uncommitted hunks:', error);
      return null;
    }
  }

  /**
   * Extracts only the added lines from a hunk
   * @param hunk The hunk text containing diff information
   * @returns String containing only the added lines (without the '+' prefix)
   */
  private static extractAddedLines(hunk: string): string {
    const lines = hunk.split('\n');
    const addedLines = lines
      .filter(line => line.startsWith('+') && !line.startsWith('+++')); // Filter out the +++ line which is part of the diff header
    
    // Remove the '+' prefix from each line
    return addedLines
      .map(line => line.substring(1))
      .join('\n');
  }

  /**
   * Gets the hunks (changed parts) of staged files
   * @param filePath Optional path to a specific file to get hunks for. If not provided, gets hunks for all staged files.
   * @returns Promise with a map of file paths to their hunks or null if error
   */
  public static async getStagedHunks(filePath?: string): Promise<Map<string, string[]> | null> {
    try {
      // Check if we're in a git repository
      if (!(await this.isGitRepository())) {
        return null;
      }

      const hunksMap = new Map<string, string[]>();
      
      // Command to get staged changes with patch information
      const diffCommand = filePath 
        ? `git diff --cached -- "${filePath}"` 
        : 'git diff --cached';
      
      const { stdout: diffOutput } = await execAsync(diffCommand);
      
      if (!diffOutput.trim()) {
        return hunksMap; // No changes
      }

      // Process the diff output to extract hunks by file
      let currentFile: string | null = null;
      let currentHunk: string[] = [];
      
      const lines = diffOutput.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for file header (diff --git a/file b/file)
        if (line.startsWith('diff --git')) {
          // Save previous file's hunks if any
          if (currentFile && currentHunk.length > 0) {
            hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
            currentHunk = [];
          }
          
          // Extract new filename from the line
          // Format: diff --git a/path/to/file b/path/to/file
          const match = line.match(/diff --git a\/(.+) b\/.+/);
          currentFile = match ? match[1] : null;
        } 
        // Check for hunk header (@@ -start,lines +start,lines @@)
        else if (line.startsWith('@@') && line.includes('@@')) {
          // Save previous hunk if any
          if (currentHunk.length > 0 && currentFile) {
            hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
            currentHunk = [];
          }
          
          // Start a new hunk
          currentHunk.push(line);
        } 
        // Add line to current hunk
        else if (currentFile && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
          currentHunk.push(line);
        }
      }
      
      // Save the last hunk if any
      if (currentFile && currentHunk.length > 0) {
        hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
      }
      
      return hunksMap;
    } catch (error) {
      console.error('Error getting staged hunks:', error);
      return null;
    }
  }

  /**
   * Gets only the added lines from unstaged/uncommitted files
   * @param filePath Optional path to a specific file to get added lines for
   * @param staged Whether to get added lines from staged changes instead of unstaged
   * @returns Promise with a map of file paths to their added lines or null if error
   */
  public static async getAddedLines(filePath?: string, staged: boolean = false): Promise<Map<string, string> | null> {
    try {
      // Get the hunks first
      const hunksMap = staged
        ? await this.getStagedHunks(filePath)
        : await this.getUncommittedHunks(filePath);
      
      if (!hunksMap) {
        return null;
      }
      
      const addedLinesMap = new Map<string, string>();
      
      // Process each file's hunks to extract only added lines
      for (const [filePath, hunks] of hunksMap.entries()) {
        let fileAddedLines = '';
        
        // Process each hunk to extract added lines
        for (const hunk of hunks) {
          const lines = hunk.split('\n');
          const addedLines = lines
            .filter(line => line.startsWith('+') && !line.startsWith('+++')) // Filter out the +++ line which is part of the diff header
            .map(line => line.substring(1)) // Remove the '+' prefix
            .join('\n');
          
          if (addedLines) {
            if (fileAddedLines) fileAddedLines += '\n';
            fileAddedLines += addedLines;
          }
        }
        
        // Only add to the map if there are added lines
        if (fileAddedLines) {
          addedLinesMap.set(filePath, fileAddedLines);
        }
      }
      
      return addedLinesMap;
    } catch (error) {
      console.error('Error getting added lines:', error);
      return null;
    }
  }
}
