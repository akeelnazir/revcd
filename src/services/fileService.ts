import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);

/**
 * Service for file operations
 */
export class FileService {
  /**
   * Saves content to a file, creating the file if it doesn't exist
   * @param filePath Path to the file
   * @param content Content to save
   * @returns Promise that resolves when the file is saved
   */
  public static async saveToFile(filePath: string, content: string): Promise<void> {
    try {
      await writeFileAsync(filePath, content, 'utf8');
    } catch (error) {
      console.error(`Error saving to file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Saves review output to REVIEW.MD file
   * @param reviewOutput Review output content
   * @returns Promise that resolves when the file is saved
   */
  public static async saveReviewOutput(reviewOutput: string): Promise<void> {
    try {
      // Format the content with a timestamp
      const timestamp = new Date().toISOString();
      const formattedContent = `# Code Review Output\n\nGenerated on: ${timestamp}\n\n${reviewOutput}`;
      
      // Save to REVIEW.MD in the current directory
      await this.saveToFile('REVIEW.MD', formattedContent);
    } catch (error) {
      console.error('Error saving review output:', error);
      throw error;
    }
  }
}
