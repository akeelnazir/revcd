#!/usr/bin/env node

import { Command } from 'commander';
import { GitService, ollamaService } from './services';

const program = new Command();

// Configure the CLI
program
  .name('rcd')
  .description('Review Code Daemon - A command-line utility')
  .version('1.0.0');


// Add status command to show uncommitted changes
program
  .command('status')
  .description('Show all uncommitted changes in the repository')
  .action(async () => {
    const isGitRepo = await GitService.isGitRepository();
    if (!isGitRepo) {
      console.error('Not a git repository');
      process.exit(1);
    }
    
    const uncommittedChanges = await GitService.getUncommittedChanges();
    if (uncommittedChanges) {
      console.log('Uncommitted Changes:');
      console.log(uncommittedChanges);
    } else {
      console.log('Error retrieving uncommitted changes');
    }
  });

// Add diff command to show the contents of an uncommitted file change
program
  .command('diff')
  .description('Show the diff content for a specific uncommitted file')
  .argument('<file>', 'file to show diff for')
  .option('-s, --staged', 'show staged changes instead of unstaged')
  .option('-p, --plain', 'show plain content without diff format')
  .action(async (file, options) => {
    const isGitRepo = await GitService.isGitRepository();
    if (!isGitRepo) {
      console.error('Not a git repository');
      process.exit(1);
    }
    
    try {
      // Use the GitService to get the file content with proper handling of all cases
      const diffContent = await GitService.getUncommittedFileContent(file, options.staged, options.plain);
      
      if (diffContent) {
        console.log(diffContent);
      } else {
        console.error(`Error retrieving diff for ${file}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error checking changes for ${file}:`, error);
      process.exit(1);
    }
  });

// Add review command to send changed code files to Ollama for review
program
  .command('review')
  .description('Send changed code files from the latest commit to Ollama for code review')
  .option('-m, --model <model>', 'specify the Ollama model to use for review')
  .option('-f, --file <file>', 'review only a specific file from the latest commit')
  .action(async (options) => {
    const isGitRepo = await GitService.isGitRepository();
    if (!isGitRepo) {
      console.error('Not a git repository');
      process.exit(1);
    }

    console.log('Fetching changed files from the latest commit...');
    
    if (options.file) {
      // Review a specific file (committed or uncommitted)
      const fileContent = await GitService.getFileContent(options.file);
      if (!fileContent) {
        console.error(`File ${options.file} not found in the latest commit or on disk`);
        process.exit(1);
      }
      
      console.log(`Reviewing ${options.file}...`);
      const review = await ollamaService.reviewCode(fileContent, options.file, options.model);
      
      if (review) {
        console.log(`\n=== Code Review for ${options.file} ===`);
        console.log(review);
      } else {
        console.error('Failed to get code review from Ollama service');
        process.exit(1);
      }
    } else {
      // Review all changed files
      const changedFiles = await GitService.getChangedFilesContent();
      
      if (!changedFiles) {
        console.error('Failed to get changed files content');
        process.exit(1);
      }
      
      if (changedFiles.size === 0) {
        console.log('No changes found in the latest commit');
        process.exit(0);
      }
      
      console.log(`Found ${changedFiles.size} changed files in the latest commit`);
      
      for (const [filePath, content] of changedFiles.entries()) {
        console.log(`\nReviewing ${filePath}...`);
        const review = await ollamaService.reviewCode(content, filePath, options.model);
        
        if (review) {
          console.log(`\n=== Code Review for ${filePath} ===`);
          console.log(review);
          console.log('\n' + '-'.repeat(80));
        } else {
          console.error(`Failed to get code review for ${filePath}`);
        }
      }
    }
  });

// Default command when no arguments are provided
if (process.argv.length <= 2) {
  console.log('Welcome to Review Code Daemon (rcd)!');
  console.log('Use --help to see available commands');
}

// Parse command-line arguments
program.parse();