import fs from 'fs';
import path from 'path';

/**
 * Service for file operations
 */
export class FileService {
  /**
   * Lists files in a directory
   * @param dirPath Directory path to list files from
   * @returns Array of file names
   */
  public static listFiles(dirPath: string): string[] {
    try {
      return fs.readdirSync(dirPath);
    } catch (error) {
      console.error(`Error listing files in ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * Checks if a file exists
   * @param filePath Path to the file
   * @returns Boolean indicating if file exists
   */
  public static fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      console.error(`Error checking if file exists ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Reads content from a file
   * @param filePath Path to the file
   * @returns File content as string or null if error
   */
  public static readFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }
}
