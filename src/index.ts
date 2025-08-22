#!/usr/bin/env node

import { Command } from 'commander';
import { FileService, SystemService } from './services';

const program = new Command();

// Configure the CLI
program
  .name('rcd')
  .description('Review Code Daemon - A command-line utility')
  .version('1.0.0');

// Add hello command
program
  .command('hello')
  .description('Say hello')
  .option('-n, --name <name>', 'name to greet')
  .action((options) => {
    const name = options.name || 'World';
    console.log(`Hello, ${name}!`);
  });

// Add ls command to list files
program
  .command('ls')
  .description('List files in a directory')
  .argument('[directory]', 'directory to list files from', process.cwd())
  .action((directory) => {
    console.log(`Files in ${directory}:`);
    const files = FileService.listFiles(directory);
    if (files.length === 0) {
      console.log('No files found');
    } else {
      files.forEach(file => console.log(`- ${file}`));
    }
  });

// Add cat command to show file contents
program
  .command('cat')
  .description('Show file contents')
  .argument('<file>', 'file to show')
  .action((file) => {
    if (!FileService.fileExists(file)) {
      console.error(`File not found: ${file}`);
      process.exit(1);
    }
    
    const content = FileService.readFile(file);
    if (content) {
      console.log(content);
    } else {
      console.error(`Could not read file: ${file}`);
      process.exit(1);
    }
  });

// Add system info command
program
  .command('sysinfo')
  .description('Show system information')
  .action(() => {
    const info = SystemService.getSystemInfo();
    console.log('System Information:');
    Object.entries(info).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
  });

// Add pwd command to show current directory
program
  .command('pwd')
  .description('Show current directory information')
  .action(() => {
    const dirInfo = SystemService.getCurrentDirInfo();
    console.log('Directory Information:');
    Object.entries(dirInfo).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
  });

// Default command when no arguments are provided
if (process.argv.length <= 2) {
  console.log('Welcome to Review Code Daemon (rcd)!');
  console.log('Use --help to see available commands');
}

// Parse command-line arguments
program.parse();