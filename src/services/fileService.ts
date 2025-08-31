import { dirname, join, normalize } from 'path';
import { promises as fsPromises } from 'fs';

export class FileService {
  public static async appendOrWriteFile(filePath: string, content: string, mode: 'append' | 'write'): Promise<void> {
    if (!filePath || !content) {
      return Promise.reject(new Error('File path and content cannot be empty'));
    }
    
    const normalizedPath = normalize(filePath);
    const directory = dirname(normalizedPath);

    try {
      await FileService.createDirectoryIfNotExists(directory);
    } catch (dirError) {
      console.error(`Failed to create directory for file ${normalizedPath}:`, dirError);
      return Promise.reject(new Error(
        `Cannot append or write to ${normalizedPath}: Failed to create directory ${directory}. ` +
        `${dirError instanceof Error ? dirError.message : String(dirError)}`
      ));
    }

    try {
      const stat = await fsPromises.stat(normalizedPath);
      if (stat.isDirectory()) {
        throw new Error(`Path exists but is not a file: ${normalizedPath}`);
      }
    } catch (statError) {
      if ((statError as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw statError;
      }
    }

    const writeMethod = mode === 'append' ? fsPromises.appendFile : fsPromises.writeFile;
    await writeMethod(normalizedPath, content, { encoding: 'utf8', mode: 0o644 });
  }

  public static async appendContentToFile(filePath: string, contentToAppend: string): Promise<void> {
    return FileService.appendOrWriteFile(filePath, contentToAppend, 'append');
  }

  public static async writeContentToFile(filePath: string, fileContent: string): Promise<void> {
    return FileService.appendOrWriteFile(filePath, fileContent, 'write');
  }

  private static async normalizeFilePath(filePath: string | null | undefined): Promise<string> {
    if (!filePath) {
      throw new Error('Invalid file path');
    }

    let normalizedPath = filePath;

    try {
      normalizedPath = normalize(filePath);
      if (normalizedPath !== filePath) {
        console.warn(`File path was normalized from ${filePath} to ${normalizedPath}`);
      }
    } catch (error) {
      throw new Error(`Error normalizing file path: ${error instanceof Error ? error.message : String(error)}`);
    }

    return normalizedPath;
  }

  private static async createDirectoryIfNotExists(directory: string): Promise<void> {
    if (!directory || /\0/.test(directory) || /[<>:"|?*]/.test(directory)) {
      throw new Error(`Invalid directory path: ${directory}`);
    }
  
    try {
      await fsPromises.mkdir(directory, { recursive: true });
    } catch (err) {
      const statError = err as NodeJS.ErrnoException;
      if ((statError as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Failed to create directory ${directory}: ${statError.message}`);
      }
      throw err;
    }
  }

  public static async writeReviewOutputToFile(reviewOutput: string, outputPath: string = 'REVIEW.md'): Promise<void> {
    if (!reviewOutput || typeof reviewOutput !== 'string') {
      return Promise.reject(new Error('Review output must be a non-empty string'));
    }

    if (!outputPath) {
      return Promise.reject(new Error('Output path cannot be empty'));
    }

    try {
      const timestamp = new Date().toISOString();
      const formattedContent = `# Code Review Output

Generated on: ${timestamp}

${reviewOutput}`;
      const filePath = join(process.cwd(), outputPath);

      try {
        await FileService.writeContentToFile(filePath, formattedContent);
        console.log(`Review output successfully saved to: ${filePath}`);
        return Promise.resolve();
      } catch (writeError) {
        return Promise.reject(new Error(
          `Failed to write review output to ${outputPath}: ${writeError instanceof Error ? writeError.message : String(writeError)}`
        ));
      }
    } catch (error) {
      console.error(`Error preparing review output for ${outputPath}:`, error);
      return Promise.reject(new Error(
        `Failed to prepare review output for ${outputPath}: ${error instanceof Error ? error.message : String(error)}. ` +
        'Please check that the review output is valid and the output path is accessible.'
      ));
    }
  }

  public static async getFileContentByLineRange(filePath: string, startLine: number, endLine: number): Promise<string | null> {
    try {
      if (!filePath) {
        console.error('File path is required');
        return null;
      }

      if (startLine < 1 || endLine < startLine) {
        console.error(`Invalid line range: ${startLine}-${endLine}`);
        return null;
      }

      const fileContent = await this.readFileContent(filePath);
      if (!fileContent) {
        console.error(`File not found: ${filePath}`);
        return null;
      }

      const lines = fileContent.split('\n');

      const start = Math.max(0, startLine - 1);
      const end = Math.min(lines.length, endLine);

      if (start >= lines.length) {
        console.error(`Start line ${startLine} exceeds file length ${lines.length}`);
        return null;
      }

      return lines.slice(start, end).join('\n');
    } catch (error) {
      console.error(`Error getting line range ${startLine}-${endLine} from ${filePath}:`, error);
      return null;
    }
  }

  private static async readFileContent(filePath: string): Promise<string | null> {
    try {
      const normalizedPath = await this.normalizeFilePath(filePath);
      const content = await fsPromises.readFile(normalizedPath, { encoding: 'utf8' });
      return content;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }
}
