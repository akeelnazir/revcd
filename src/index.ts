#!/usr/bin/env node

import { Command } from 'commander';
import { GitService, ollamaService } from './services';
import { CODE_REVIEW_CONFIG } from './config/codeReview.config';

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

// Add hunks command to show changed parts of unstaged/uncommitted files
program
  .command('hunks')
  .description('Show only the changed parts (hunks) of unstaged/uncommitted files')
  .option('-f, --file <file>', 'show hunks for a specific file only')
  .option('-s, --staged', 'show hunks for staged changes instead of unstaged')
  .action(async (options) => {
    const isGitRepo = await GitService.isGitRepository();
    if (!isGitRepo) {
      console.error('Not a git repository');
      process.exit(1);
    }
    
    try {
      // Get the hunks based on whether we want staged or unstaged changes
      const hunksMap = options.staged
        ? await GitService.getStagedHunks(options.file)
        : await GitService.getUncommittedHunks(options.file);
      
      if (!hunksMap) {
        console.error('Error retrieving hunks');
        process.exit(1);
      }
      
      if (hunksMap.size === 0) {
        console.log(options.staged ? 'No staged changes found' : 'No unstaged changes found');
        process.exit(0);
      }
      
      console.log(`Found changes in ${hunksMap.size} file(s):\n`);
      
      // Display the hunks for each file
      for (const [filePath, hunks] of hunksMap.entries()) {
        console.log(`\n=== ${filePath} ===`);
        hunks.forEach((hunk, index) => {
          console.log(`\n--- Hunk ${index + 1} ---`);
          console.log(hunk);
        });
        console.log('\n' + '-'.repeat(80));
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Add review command to send uncommitted code files to Ollama for review
program
  .command('review')
  .description('Send uncommitted code files to Ollama for code review')
  .option('-m, --model <model>', 'specify the Ollama model to use for review')
  .option('-f, --file <file>', 'review only a specific file')
  .option('-a, --all', 'review all files, not just code files')
  .option('-h, --hunks-only', 'review only the added hunks/lines instead of entire files')
  .option('-s, --staged', 'review staged changes instead of unstaged changes (works with --hunks-only)')
  .action(async (options) => {
    const isGitRepo = await GitService.isGitRepository();
    if (!isGitRepo) {
      console.error('Not a git repository');
      process.exit(1);
    }

    // Show which file extensions will be reviewed
    if (!options.all && !options.file) {
      console.log(`Fetching ${options.staged ? 'staged' : 'uncommitted'} code files (extensions: ${CODE_REVIEW_CONFIG.FILE_EXTENSIONS.join(', ')})...`);
    } else {
      console.log(`Fetching ${options.staged ? 'staged' : 'uncommitted'} files...`);
    }
    
    if (options.file) {
      // Review a specific file
      if (options.hunksOnly) {
        // Get only the added lines from the specified file
        const addedLinesMap = await GitService.getAddedLines(options.file, options.staged);
        
        if (!addedLinesMap || addedLinesMap.size === 0) {
          console.log(`No added lines found in ${options.file}`);
          process.exit(0);
        }
        
        const addedLines = addedLinesMap.get(options.file);
        if (!addedLines) {
          console.log(`No added lines found in ${options.file}`);
          process.exit(0);
        }
        
        console.log(`Reviewing added lines in ${options.file}...`);
        
        // Display the formatted code before the review
        console.log(`\n=== Added Code in ${options.file} ===`);
        console.log('```');
        console.log(addedLines);
        console.log('```\n');
        
        const review = await ollamaService.reviewCode(addedLines, options.file, options.model);
        
        if (review) {
          console.log(`=== Code Review for added lines in ${options.file} ===`);
          console.log(review);
        } else {
          console.error('Failed to get code review from Ollama service');
          process.exit(1);
        }
      } else {
        // Review the entire file (committed or uncommitted)
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
      }
    } else if (options.hunksOnly) {
      // Review only added lines from all files
      const addedLinesMap = await GitService.getAddedLines(undefined, options.staged);
      
      if (!addedLinesMap) {
        console.error('Failed to get added lines');
        process.exit(1);
      }
      
      if (addedLinesMap.size === 0) {
        console.log(`No added lines found in ${options.staged ? 'staged' : 'unstaged'} changes`);
        process.exit(0);
      }
      
      console.log(`Found added lines in ${addedLinesMap.size} files`);
      
      for (const [filePath, addedLines] of addedLinesMap.entries()) {
        console.log(`\nReviewing added lines in ${filePath}...`);
        
        // Display the formatted code before the review
        console.log(`\n=== Added Code in ${filePath} ===`);
        console.log('```');
        console.log(addedLines);
        console.log('```\n');
        
        const review = await ollamaService.reviewCode(addedLines, filePath, options.model);
        
        if (review) {
          console.log(`=== Code Review for added lines in ${filePath} ===`);
          console.log(review);
          console.log('\n' + '-'.repeat(80));
        } else {
          console.error(`Failed to get code review for ${filePath}`);
        }
      }
    } else {
      // Review all uncommitted files
      const uncommittedFiles = await GitService.getUncommittedFilesContent(!options.all);
      
      if (!uncommittedFiles) {
        console.error('Failed to get uncommitted files content');
        process.exit(1);
      }
      
      if (uncommittedFiles.size === 0) {
        console.log('No uncommitted changes found');
        process.exit(0);
      }
      
      console.log(`Found ${uncommittedFiles.size} uncommitted files`);
      
      for (const [filePath, content] of uncommittedFiles.entries()) {
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