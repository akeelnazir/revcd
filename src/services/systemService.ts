import os from 'os';

/**
 * Service for system information
 */
export class SystemService {
  /**
   * Gets system information
   * @returns Object containing system information
   */
  public static getSystemInfo(): Record<string, any> {
    return {
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: this.formatBytes(os.totalmem()),
      freeMemory: this.formatBytes(os.freemem()),
      uptime: this.formatUptime(os.uptime())
    };
  }

  /**
   * Gets current directory information
   * @returns Object containing directory information
   */
  public static getCurrentDirInfo(): Record<string, any> {
    return {
      currentDirectory: process.cwd(),
      homeDirectory: os.homedir(),
      tempDirectory: os.tmpdir()
    };
  }

  /**
   * Formats bytes to human-readable format
   * @param bytes Bytes to format
   * @returns Formatted string
   */
  private static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(2)} ${units[i]}`;
  }

  /**
   * Formats uptime to human-readable format
   * @param seconds Uptime in seconds
   * @returns Formatted string
   */
  private static formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
  }
}
