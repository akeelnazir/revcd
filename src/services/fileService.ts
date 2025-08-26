import { promises as fsPromises } from 'fs';
import * as path from 'path';

export class FileService {
  public static async appendContentToFile(filePath: string, contentToAppend: string): Promise<void> {
    if (!filePath) {
      return Promise.reject(new Error('File path cannot be empty'));
    }
    
    if (filePath.includes('\0')) {
      return Promise.reject(new Error(`Invalid file path containing null bytes: ${filePath}`));
    }
    
    if (contentToAppend === undefined) {
      return Promise.reject(new Error('Content to append cannot be undefined'));
    }

    try {
      const normalizedPath = path.normalize(filePath);
      const directory = path.dirname(normalizedPath);
      
      try {
        await FileService.createDirectoryIfNotExists(directory);
      } catch (dirError) {
        console.error(`Failed to create directory for file ${normalizedPath}:`, dirError);
        return Promise.reject(new Error(
          `Cannot append to ${normalizedPath}: Failed to create directory ${directory}. ` +
          `${dirError instanceof Error ? dirError.message : String(dirError)}`
        ));
      }
      
      try {
        await fsPromises.access(normalizedPath, fsPromises.constants.F_OK);
        await fsPromises.appendFile(normalizedPath, contentToAppend, { encoding: 'utf8' });
      } catch (error) {
        await fsPromises.writeFile(normalizedPath, contentToAppend, { 
          encoding: 'utf8',
          mode: 0o644,
          flag: 'w' 
        });
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error(`Error appending to file at ${filePath}:`, error);
      return Promise.reject(new Error(
        `Failed to append to file at ${filePath}: ${error instanceof Error ? error.message : String(error)}. ` +
        'Please check file permissions, disk space, and that the path is valid and accessible.'
      ));
    }
  }

  public static async writeContentToFile(filePath: string, fileContent: string): Promise<void> {
    if (!filePath) {
      return Promise.reject(new Error('File path cannot be empty'));
    }
    
    if (filePath.includes('\0')) {
      return Promise.reject(new Error(`Invalid file path containing null bytes: ${filePath}`));
    }
    
    if (fileContent === undefined) {
      return Promise.reject(new Error('File content cannot be undefined'));
    }

    try {
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath !== filePath) {
        console.warn(`File path was normalized from ${filePath} to ${normalizedPath}`);
      }
      
      const directory = path.dirname(normalizedPath);
      
      try {
        await FileService.createDirectoryIfNotExists(directory);
      } catch (dirError) {
        console.error(`Failed to create directory for file ${normalizedPath}:`, dirError);
        return Promise.reject(new Error(
          `Cannot write to ${normalizedPath}: Failed to create directory ${directory}. ` +
          `${dirError instanceof Error ? dirError.message : String(dirError)}`
        ));
      }
      
      await fsPromises.writeFile(normalizedPath, fileContent, { 
        encoding: 'utf8',
        mode: 0o644,
        flag: 'w' 
      });
      
      return Promise.resolve();
    } catch (error) {
      console.error(`Error writing file at ${filePath}:`, error);
      return Promise.reject(new Error(
        `Failed to write file at ${filePath}: ${error instanceof Error ? error.message : String(error)}. ` +
        'Please check file permissions, disk space, and that the path is valid and accessible.'
      ));
    }
  }

  private static async createDirectoryIfNotExists(directory: string): Promise<void> {
    try {
      if (!directory || directory.includes('\0') || /[<>:"|?*]/.test(directory)) {
        throw new Error(`Invalid directory path: ${directory}`);
      }
      
      try {
        const stats = await fsPromises.stat(directory);
        if (!stats.isDirectory()) {
          throw new Error(`Path exists but is not a directory: ${directory}`);
        }
        return;
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw statError;
        }
        await fsPromises.mkdir(directory, { recursive: true });
      }
    } catch (error) {
      console.error(`Error creating directory ${directory}:`, error);
      const newError = new Error(
        `Failed to create directory ${directory}: ${error instanceof Error ? error.message : String(error)}. ` +
        'Please check directory permissions, disk space, and that the path is valid and not reserved by the system.'
      );
      (newError as Error & { cause: unknown }).cause = error;
      throw newError;
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
      const filePath = path.join(process.cwd(), outputPath);
      
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

}
