import { exec } from 'child_process';
import { promisify } from 'util';
import { CODE_REVIEW_CONFIG } from '../config';
import path from 'path';

const execAsync = promisify(exec);

export class GitService {
  public static async isGitRepository(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree');
      return true;
    } catch (error) {
      return false;
    }
  }

  private static fileContentCache = new Map<string, string>();

  public static async getFileFromLatestCommit(filePath: string, useCache: boolean = true): Promise<string | null> {
    try {
      if (!(await this.isGitRepository())) {
        return null;
      }

      const cacheKey = `HEAD:${filePath}`;
      if (useCache && this.fileContentCache.has(cacheKey)) {
        return this.fileContentCache.get(cacheKey) || null;
      }
      
      try {
        const { stdout: fileContent } = await execAsync(`git show HEAD:${filePath}`);
        
        if (useCache) {
          this.fileContentCache.set(cacheKey, fileContent);
        }
        
        return fileContent;
      } catch (commitError) {
        try {
          const { stdout: fileExists } = await execAsync(`[ -f "${filePath}" ] && echo "exists" || echo ""`);
          
          if (fileExists.trim() === 'exists') {
            const { stdout: diskContent } = await execAsync(`cat "${filePath}"`);
            return diskContent;
          } else {
            return null;
          }
        } catch (diskError) {
          return null;
        }
      }
    } catch (error) {
      console.error(`Error getting file content for ${filePath}:`, error);
      return null;
    }
  }

  private static shouldIncludeFile(filePath: string): boolean {
    const extension = path.extname(filePath).slice(1).toLowerCase();
    
    if (!extension) return false;
    
    return CODE_REVIEW_CONFIG.FILE_EXTENSIONS.includes(extension);
  }

  private static uncommittedFileCache = new Map<string, string>();

  public static async getUncommittedFilesContent(filterByExtension: boolean = true, useCache: boolean = true): Promise<Map<string, string> | null> {
    try {
      if (!(await this.isGitRepository())) {
        return null;
      }
      
      const fileContents = new Map<string, string>();
      const { stdout: modifiedFiles } = await execAsync('git ls-files --modified');
      const { stdout: stagedFiles } = await execAsync('git diff --name-only --cached');
      const { stdout: untrackedFiles } = await execAsync('git ls-files --others --exclude-standard');
      const allFiles = new Set<string>(
        [...modifiedFiles.trim().split('\n'), 
         ...stagedFiles.trim().split('\n'),
         ...untrackedFiles.trim().split('\n')]
        .filter(file => file.trim() !== '')
      );
      const filesToProcess = filterByExtension ? 
        Array.from(allFiles).filter(file => this.shouldIncludeFile(file)) : 
        Array.from(allFiles);
      
      for (const filePath of filesToProcess) {
        try {
          const cacheKey = `uncommitted:${filePath}`;
          if (useCache && this.uncommittedFileCache.has(cacheKey)) {
            fileContents.set(filePath, this.uncommittedFileCache.get(cacheKey) || '');
            continue;
          }
          
          const { stdout: fileContent } = await execAsync(`cat "${filePath}"`);
          
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

  public static async getFileContent(filePath: string, useCache: boolean = true): Promise<string | null> {
    const commitContent = await this.getFileFromLatestCommit(filePath, useCache);
    if (commitContent !== null) {
      return commitContent;
    }
    
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

  public static async getUncommittedHunks(filePath?: string): Promise<Map<string, string[]> | null> {
    try {
      if (!(await this.isGitRepository())) {
        return null;
      }

      const hunksMap = new Map<string, string[]>();
      const diffCommand = filePath 
        ? `git diff -- "${filePath}"` 
        : 'git diff';
      const { stdout: diffOutput } = await execAsync(diffCommand);
      
      if (!diffOutput.trim()) {
        return hunksMap;
      }

      let currentFile: string | null = null;
      let currentHunk: string[] = [];
      
      const lines = diffOutput.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('diff --git')) {
          if (currentFile && currentHunk.length > 0) {
            hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
            currentHunk = [];
          }
          
          const match = line.match(/diff --git a\/(.+) b\/.+/);
          currentFile = match ? match[1] : null;
        } else if (line.startsWith('@@') && line.includes('@@')) {
          if (currentHunk.length > 0 && currentFile) {
            hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
            currentHunk = [];
          }
          
          currentHunk.push(line);
        } else if (currentFile && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
          currentHunk.push(line);
        }
      }
      
      if (currentFile && currentHunk.length > 0) {
        hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
      }
      
      return hunksMap;
    } catch (error) {
      console.error('Error getting uncommitted hunks:', error);
      return null;
    }
  }

  public static async getStagedHunks(filePath?: string): Promise<Map<string, string[]> | null> {
    try {
      if (!(await this.isGitRepository())) {
        return null;
      }

      const hunksMap = new Map<string, string[]>();
      
      const diffCommand = filePath 
        ? `git diff --cached -- "${filePath}"` 
        : 'git diff --cached';
      
      const { stdout: diffOutput } = await execAsync(diffCommand);
      
      if (!diffOutput.trim()) {
        return hunksMap;
      }

      let currentFile: string | null = null;
      let currentHunk: string[] = [];
      
      const lines = diffOutput.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('diff --git')) {
          if (currentFile && currentHunk.length > 0) {
            hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
            currentHunk = [];
          }
          
          const match = line.match(/diff --git a\/(.+) b\/.+/);
          currentFile = match ? match[1] : null;
        } 
        else if (line.startsWith('@@') && line.includes('@@')) {
          if (currentHunk.length > 0 && currentFile) {
            hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
            currentHunk = [];
          }
          
          currentHunk.push(line);
        } 
        else if (currentFile && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
          currentHunk.push(line);
        }
      }
      
      if (currentFile && currentHunk.length > 0) {
        hunksMap.set(currentFile, [...(hunksMap.get(currentFile) || []), currentHunk.join('\n')]);
      }
      
      return hunksMap;
    } catch (error) {
      console.error('Error getting staged hunks:', error);
      return null;
    }
  }

  public static async getAddedLines(filePath?: string, staged: boolean = false, filterByExtension: boolean = true): Promise<Map<string, string> | null> {
    try {
      const hunksMap = staged
        ? await this.getStagedHunks(filePath)
        : await this.getUncommittedHunks(filePath);
      
      if (!hunksMap) {
        return null;
      }
      
      const addedLinesMap = new Map<string, string>();
      
      for (const [filePath, hunks] of hunksMap.entries()) {
        if (filterByExtension && !this.shouldIncludeFile(filePath)) {
          continue;
        }
        
        let fileAddedLines = '';
        
        for (const hunk of hunks) {
          const lines = hunk.split('\n');
          const addedLines = lines
            .filter((line: string) => line.startsWith('+') && !line.startsWith('+++'))
            .map((line: string) => line.substring(1))
            .join('\n');
          
          if (addedLines) {
            if (fileAddedLines) fileAddedLines += '\n';
            fileAddedLines += addedLines;
          }
        }
        
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
