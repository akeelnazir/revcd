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
   * Gets the diff content for a specific uncommitted file
   * @param filePath Path to the file
   * @param staged Whether to show staged or unstaged changes
   * @param plainContent Whether to show plain content without diff format
   * @returns Promise with the diff content or null if error
   */
  public static async getUncommittedFileContent(filePath: string, staged: boolean = false, plainContent: boolean = false): Promise<string | null> {
    try {
      // Check if we're in a git repository
      if (!(await this.isGitRepository())) {
        return null;
      }

      // Check if the file exists in git
      const { stdout: fileExists } = await execAsync(`git ls-files --error-unmatch ${filePath}`).catch(() => ({ stdout: '' }));
      
      // For untracked files, we can't show a diff
      if (!fileExists && !staged) {
        // Check if it's an untracked file
        const { stdout: untrackedStatus } = await execAsync(`git ls-files --others --exclude-standard ${filePath}`).catch(() => ({ stdout: '' }));
        
        if (untrackedStatus.trim()) {
          // For untracked files, just show the file content
          const { stdout: fileContent } = await execAsync(`cat ${filePath}`).catch(() => ({ stdout: 'Unable to read file content' }));
          return `# New file: ${filePath}\n\n${fileContent}`;
        }
        
        return `File not found in repository: ${filePath}`;
      }
      
      // First check if there are any changes to the file
      const checkDiffCommand = staged ? 
        `git diff --staged -- ${filePath}` : 
        `git diff -- ${filePath}`;
      
      const { stdout: checkDiffOutput } = await execAsync(checkDiffCommand);
      
      // If there are no changes, return early with a consistent message
      if (!checkDiffOutput.trim()) {
        return `No changes for ${filePath}`;
      }
      
      // Get the diff for the file
      let diffCommand;
      if (plainContent) {
        // For plain content view, we need to get the current content of the file
        if (staged) {
          // For staged changes, get the version in the index
          diffCommand = `git show :${filePath}`;
        } else {
          // For unstaged changes, get the working copy
          diffCommand = `cat ${filePath}`;
        }
      } else {
        // Standard diff format
        diffCommand = checkDiffCommand; // Reuse the diff command we already ran
      }
      
      const { stdout: diffOutput } = await execAsync(diffCommand);
      
      // Check if there are no changes
      if (!diffOutput.trim()) {
        // For plain content, we still want to show "No changes" message
        if (plainContent) {
          return `No changes for ${filePath}`;
        }
        
        // If no diff output but file exists, it might be staged for addition
        if (staged) {
          const { stdout: stagedStatus } = await execAsync(`git status --porcelain ${filePath}`);
          if (stagedStatus.startsWith('A ')) {
            const { stdout: fileContent } = await execAsync(`git show :${filePath}`);
            return `# New file staged for commit: ${filePath}\n\n${fileContent}`;
          }
        }
        return `No changes for ${filePath}`;
      }
      
      // If plain content was requested but we used diff, we need to extract just the content
      if (plainContent && diffCommand.startsWith('git diff')) {
        // Extract only the content lines from the diff output (without + and - prefixes)
        const lines = diffOutput.trim().split('\n');
        const contentLines = [];
        let inContent = false;
        
        for (const line of lines) {
          // Skip diff header lines
          if (line.startsWith('diff --git') || 
              line.startsWith('index ') || 
              line.startsWith('---') || 
              line.startsWith('+++')) {
            continue;
          }
          
          // Start of a hunk
          if (line.startsWith('@@')) {
            inContent = true;
            continue;
          }
          
          if (inContent) {
            // Skip removed lines (starting with -)
            if (line.startsWith('-')) {
              continue;
            }
            
            // Add content lines, removing the + prefix if present
            if (line.startsWith('+')) {
              contentLines.push(line.substring(1));
            } else if (!line.startsWith('\\')) { // Skip 'No newline at end of file' markers
              contentLines.push(line);
            }
          }
        }
        
        return contentLines.join('\n');
      }
      
      return diffOutput.trim();
    } catch (error) {
      console.error(`Error getting uncommitted changes for ${filePath}:`, error);
      return null;
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
}
