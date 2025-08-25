#!/usr/bin/env node

import { Command } from 'commander';
import { GitService, ollamaService, FileService } from './services';
import { CODE_REVIEW_CONFIG } from './config';

const program = new Command();

program
  .name('rcd')
  .description('Review Code - A command-line utility to review code changes')
  .version('1.0.0');

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

    let reviewOutput = '';
    
    const appendToReviewOutput = (text: string) => {
      reviewOutput += text + '\n';
    };

    if (!options.all && !options.file) {
      const message = `Fetching ${options.staged ? 'staged' : 'uncommitted'} code files (extensions: ${CODE_REVIEW_CONFIG.FILE_EXTENSIONS.join(', ')})`;
      console.log(message + '...');
      appendToReviewOutput(message);
    } else {
      const message = `Fetching ${options.staged ? 'staged' : 'uncommitted'} files`;
      console.log(message + '...');
      appendToReviewOutput(message);
    }
    
    if (options.file) {
      if (options.hunksOnly) {
        const addedLinesMap = await GitService.getAddedLines(options.file, options.staged, !options.all);
        
        if (!addedLinesMap || addedLinesMap.size === 0) {
          const message = `No added lines found in ${options.file}`;
          console.log(message);
          appendToReviewOutput(message);
          await FileService.writeReviewOutputToFile(reviewOutput);
          process.exit(0);
        }
        
        const addedLines = addedLinesMap.get(options.file);
        if (!addedLines) {
          const message = `No added lines found in ${options.file}`;
          console.log(message);
          appendToReviewOutput(message);
          await FileService.writeReviewOutputToFile(reviewOutput);
          process.exit(0);
        }
        
        const reviewingMessage = `Reviewing added lines in ${options.file}...`;
        console.log(reviewingMessage);
        appendToReviewOutput(reviewingMessage);
        
        const codeHeader = `\n=== Added Code in ${options.file} ===`;
        console.log(codeHeader);
        appendToReviewOutput(codeHeader);
        console.log('```');
        appendToReviewOutput('```');
        console.log(addedLines);
        appendToReviewOutput(addedLines);
        console.log('```\n');
        appendToReviewOutput('```\n');
        
        const review = await ollamaService.reviewCode(addedLines, options.file, options.model);
        
        if (review) {
          const reviewHeader = `=== Code Review for added lines in ${options.file} ===`;
          console.log(reviewHeader);
          appendToReviewOutput(reviewHeader);
          console.log(review);
          appendToReviewOutput(review);
          
          await FileService.writeReviewOutputToFile(reviewOutput);
        } else {
          const errorMessage = 'Failed to get code review from Ollama service';
          console.error(errorMessage);
          appendToReviewOutput(errorMessage);
          await FileService.writeReviewOutputToFile(reviewOutput);
          process.exit(1);
        }
      } else {
        const fileContent = await GitService.getFileContent(options.file);
        if (!fileContent) {
          const errorMessage = `File ${options.file} not found in the latest commit or on disk`;
          console.error(errorMessage);
          appendToReviewOutput(errorMessage);
          await FileService.writeReviewOutputToFile(reviewOutput);
          process.exit(1);
        }
        
        const reviewingMessage = `Reviewing ${options.file}...`;
        console.log(reviewingMessage);
        appendToReviewOutput(reviewingMessage);
        
        const review = await ollamaService.reviewCode(fileContent, options.file, options.model);
        
        if (review) {
          const reviewHeader = `\n=== Code Review for ${options.file} ===`;
          console.log(reviewHeader);
          appendToReviewOutput(reviewHeader);
          console.log(review);
          appendToReviewOutput(review);
          
          await FileService.writeReviewOutputToFile(reviewOutput);
        } else {
          const errorMessage = 'Failed to get code review from Ollama service';
          console.error(errorMessage);
          appendToReviewOutput(errorMessage);
          await FileService.writeReviewOutputToFile(reviewOutput);
          process.exit(1);
        }
      }
    } else if (options.hunksOnly) {
      const addedLinesMap = await GitService.getAddedLines(undefined, options.staged, !options.all);
      
      if (!addedLinesMap) {
        const errorMessage = 'Failed to get added lines';
        console.error(errorMessage);
        appendToReviewOutput(errorMessage);
        await FileService.writeReviewOutputToFile(reviewOutput);
        process.exit(1);
      }
      
      if (addedLinesMap.size === 0) {
        const message = `No added lines found in ${options.staged ? 'staged' : 'unstaged'} changes`;
        console.log(message);
        appendToReviewOutput(message);
        await FileService.writeReviewOutputToFile(reviewOutput);
        process.exit(0);
      }
      
      const foundMessage = `Found added lines in ${addedLinesMap.size} files`;
      console.log(foundMessage);
      appendToReviewOutput(foundMessage);
      
      for (const [filePath, addedLines] of addedLinesMap.entries()) {
        const reviewingMessage = `\nReviewing added lines in ${filePath}...`;
        console.log(reviewingMessage);
        appendToReviewOutput(reviewingMessage);
        
        const codeHeader = `\n=== Added Code in ${filePath} ===`;
        console.log(codeHeader);
        appendToReviewOutput(codeHeader);
        console.log('```');
        appendToReviewOutput('```');
        console.log(addedLines);
        appendToReviewOutput(addedLines);
        console.log('```\n');
        appendToReviewOutput('```\n');
        
        const review = await ollamaService.reviewCode(addedLines, filePath, options.model);
        
        if (review) {
          const reviewHeader = `=== Code Review for added lines in ${filePath} ===`;
          console.log(reviewHeader);
          appendToReviewOutput(reviewHeader);
          console.log(review);
          appendToReviewOutput(review);
          const separator = '\n' + '-'.repeat(80);
          console.log(separator);
          appendToReviewOutput(separator);
        } else {
          const errorMessage = `Failed to get code review for ${filePath}`;
          console.error(errorMessage);
          appendToReviewOutput(errorMessage);
        }
      }
      
      await FileService.writeReviewOutputToFile(reviewOutput);
    } else {
      const uncommittedFiles = await GitService.getUncommittedFilesContent(!options.all);
      
      if (!uncommittedFiles) {
        const errorMessage = 'Failed to get uncommitted files content';
        console.error(errorMessage);
        appendToReviewOutput(errorMessage);
        await FileService.writeReviewOutputToFile(reviewOutput);
        process.exit(1);
      }
      
      if (uncommittedFiles.size === 0) {
        const message = 'No uncommitted changes found';
        console.log(message);
        appendToReviewOutput(message);
        await FileService.writeReviewOutputToFile(reviewOutput);
        process.exit(0);
      }
      
      const foundMessage = `Found ${uncommittedFiles.size} uncommitted files`;
      console.log(foundMessage);
      appendToReviewOutput(foundMessage);
      
      for (const [filePath, content] of uncommittedFiles.entries()) {
        const reviewingMessage = `\nReviewing ${filePath}...`;
        console.log(reviewingMessage);
        appendToReviewOutput(reviewingMessage);
        
        const review = await ollamaService.reviewCode(content, filePath, options.model);
        
        if (review) {
          const reviewHeader = `\n=== Code Review for ${filePath} ===`;
          console.log(reviewHeader);
          appendToReviewOutput(reviewHeader);
          console.log(review);
          appendToReviewOutput(review);
          const separator = '\n' + '-'.repeat(80);
          console.log(separator);
          appendToReviewOutput(separator);
        } else {
          const errorMessage = `Failed to get code review for ${filePath}`;
          console.error(errorMessage);
          appendToReviewOutput(errorMessage);
        }
      }
      
      await FileService.writeReviewOutputToFile(reviewOutput);
    }
  });

if (process.argv.length <= 2) {
  console.log('Welcome to Review Code (rcd)!');
  console.log('Use --help to see available commands');
}

program.parse();