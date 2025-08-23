import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Service for Git operations
 */
export class GitService {
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
        diffCommand = staged ? 
          `git diff --staged -- ${filePath}` : 
          `git diff -- ${filePath}`;
      }
      
      const { stdout: diffOutput } = await execAsync(diffCommand);
      
      if (!diffOutput.trim() && !plainContent) {
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

  /**
   * Gets the content of a file from the latest commit or from disk if not committed
   * @param filePath Path to the file
   * @returns Promise with the file content or null if error
   */
  public static async getFileFromLatestCommit(filePath: string): Promise<string | null> {
    try {
      // Check if we're in a git repository
      if (!(await this.isGitRepository())) {
        return null;
      }
      
      try {
        // Try to get the content of the file from the latest commit
        const { stdout: fileContent } = await execAsync(`git show HEAD:${filePath}`);
        return fileContent;
      } catch (commitError) {
        // If the file doesn't exist in HEAD, check if it exists on disk
        try {
          const { stdout: fileExists } = await execAsync(`[ -f "${filePath}" ] && echo "exists" || echo ""`);
          
          if (fileExists.trim() === 'exists') {
            // File exists on disk but not in HEAD, read it directly
            const { stdout: diskContent } = await execAsync(`cat "${filePath}"`);
            console.log(`File ${filePath} not found in the latest commit, using current version from disk`);
            return diskContent;
          } else {
            console.error(`File ${filePath} not found in the latest commit or on disk`);
            return null;
          }
        } catch (diskError) {
          console.error(`Error checking file on disk for ${filePath}:`, diskError);
          return null;
        }
      }
    } catch (error) {
      console.error(`Error getting file content for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Gets all changed files with their content from the latest commit
   * @returns Promise with map of file paths to their content or null if error
   */
  public static async getChangedFilesContent(): Promise<Map<string, string> | null> {
    try {
      const changedFiles = await this.getLatestCommitChanges();
      
      if (!changedFiles) {
        return new Map();
      }
      
      const fileContents = new Map<string, string>();
      
      // Process files from the latest commit
      for (const filePath of changedFiles) {
        const content = await this.getFileFromLatestCommit(filePath);
        if (content !== null) {
          fileContents.set(filePath, content);
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
   * @returns Promise with the file content or null if error
   */
  public static async getFileContent(filePath: string): Promise<string | null> {
    // First try to get from latest commit
    const commitContent = await this.getFileFromLatestCommit(filePath);
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
