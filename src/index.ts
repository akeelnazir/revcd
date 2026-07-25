#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { GitService, llmService, FileService } from './services';
import { CODE_REVIEW_CONFIG, LLM_CONFIG } from './config';
import { getFileLanguageFromPath } from './utils';

const program = new Command();

let packageJsonPath = path.join(__dirname, '..', 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

program
  .name('rcd')
  .description('Review Code - A command-line utility to review code changes')
  .version(packageJson.version);

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
  .description('Send uncommitted code files to LLM for code review')
  .option('-m, --model <model>', 'specify the LLM model to use for review (defaults to LLM_DEFAULT_MODEL env var if not provided)')
  .option('-f, --file <file>', 'review only a specific file')
  .option('-a, --all', 'review all files, not just code files')
  .option('-h, --hunks-only', 'review only the added hunks/lines instead of entire files')
  .option('-s, --staged', 'review staged changes instead of unstaged changes (works with --hunks-only)')
  .option('-l, --lines <range>', 'review only a specific line range in format L:n-m (e.g., L:10-20)')
  .action(async (options) => {
    const isGitRepo = await GitService.isGitRepository();
    if (!isGitRepo) {
      console.error('Not a git repository');
      process.exit(1);
    }

    if (options.lines && options.hunksOnly) {
      console.error('Error: Cannot use both --lines and --hunks-only options together');
      process.exit(1);
    }

    if (options.lines && !options.file) {
      console.error('Error: The --lines option requires a specific file (use with --file)');
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
      if (options.lines) {
        const lineRangeMatch = options.lines.match(/^L:([0-9]+)-([0-9]+)$/i);
        if (!lineRangeMatch) {
          const errorMessage = `Invalid line range format: ${options.lines}. Expected format: L:n-m (e.g., L:10-20)`;
          console.error(errorMessage);
          appendToReviewOutput(errorMessage);
          await FileService.writeReviewOutputToFile(reviewOutput);
          process.exit(1);
        }

        const startLine = parseInt(lineRangeMatch[1], 10);
        const endLine = parseInt(lineRangeMatch[2], 10);


        const lineRangeContent = await FileService.getFileContentByLineRange(options.file, startLine, endLine);

        if (!lineRangeContent) {
          const errorMessage = `Failed to get content for lines ${startLine}-${endLine} in ${options.file}`;
          console.error(errorMessage);
          appendToReviewOutput(errorMessage);
          await FileService.writeReviewOutputToFile(reviewOutput);
          process.exit(1);
        }

        const modelToUse = options.model || LLM_CONFIG.DEFAULT_MODEL;
        const codeHeader = `\n=== Code in ${options.file} (lines ${startLine}-${endLine}) ===`;
        console.log(codeHeader);
        appendToReviewOutput(codeHeader);
        console.log('```' + getFileLanguageFromPath(options.file).toLowerCase());
        appendToReviewOutput('```' + getFileLanguageFromPath(options.file).toLowerCase());
        console.log(lineRangeContent);
        appendToReviewOutput(lineRangeContent);
        console.log('```\n');
        appendToReviewOutput('```\n');

        const reviewingMessage = `Reviewing lines ${startLine}-${endLine} in ${options.file} using ${modelToUse}...`;
        console.log(reviewingMessage + '\n');
        appendToReviewOutput(reviewingMessage + '\n');

        const review = await llmService.reviewCode(lineRangeContent, options.file, modelToUse);

        if (review) {
          const reviewHeader = `=== Code Review for ${options.file} (lines ${startLine}-${endLine}) ===`;
          console.log(reviewHeader);
          appendToReviewOutput(reviewHeader);
          console.log(review);
          appendToReviewOutput(review);

          await FileService.writeReviewOutputToFile(reviewOutput);
        } else {
          const errorMessage = 'Failed to get code review from LLM service';
          console.error(errorMessage);
          appendToReviewOutput(errorMessage);
          await FileService.writeReviewOutputToFile(reviewOutput);
          process.exit(1);
        }
      }
      else if (options.hunksOnly) {
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

        const modelToUse = options.model || LLM_CONFIG.DEFAULT_MODEL;
        const reviewingMessage = `Reviewing added lines in ${options.file} using ${modelToUse}...`;
        console.log(reviewingMessage + '\n');
        appendToReviewOutput(reviewingMessage + '\n');

        const codeHeader = `\n=== Added Code in ${options.file} ===`;
        console.log(codeHeader);
        appendToReviewOutput(codeHeader);
        console.log('```' + getFileLanguageFromPath(options.file).toLowerCase());
        appendToReviewOutput('```' + getFileLanguageFromPath(options.file).toLowerCase());
        console.log(addedLines);
        appendToReviewOutput(addedLines);
        console.log('```\n');
        appendToReviewOutput('```\n');

        const review = await llmService.reviewCode(addedLines, options.file, modelToUse);

        if (review) {
          const reviewHeader = `=== Code Review for added lines in ${options.file} ===`;
          console.log(reviewHeader);
          appendToReviewOutput(reviewHeader);
          console.log(review);
          appendToReviewOutput(review);

          await FileService.writeReviewOutputToFile(reviewOutput);
        } else {
          const errorMessage = 'Failed to get code review from LLM service';
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

        const modelToUse = options.model || LLM_CONFIG.DEFAULT_MODEL;
        const reviewingMessage = `Reviewing ${options.file} using ${modelToUse}...`;
        console.log(reviewingMessage + '\n');
        appendToReviewOutput(reviewingMessage + '\n');

        const review = await llmService.reviewCode(fileContent, options.file, modelToUse);

        if (review) {
          const reviewHeader = `\n=== Code Review for ${options.file} ===`;
          console.log(reviewHeader);
          appendToReviewOutput(reviewHeader);
          console.log(review);
          appendToReviewOutput(review);

          await FileService.writeReviewOutputToFile(reviewOutput);
        } else {
          const errorMessage = 'Failed to get code review from LLM service';
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
        const modelToUse = options.model || LLM_CONFIG.DEFAULT_MODEL;
        const reviewingMessage = `\nReviewing added lines in ${filePath} using ${modelToUse}...`;
        console.log(reviewingMessage + '\n');
        appendToReviewOutput(reviewingMessage + '\n');

        const codeHeader = `\n=== Added Code in ${filePath} ===`;
        console.log(codeHeader);
        appendToReviewOutput(codeHeader);
        console.log('```');
        appendToReviewOutput('```');
        console.log(addedLines);
        appendToReviewOutput(addedLines);
        console.log('```\n');
        appendToReviewOutput('```\n');

        const review = await llmService.reviewCode(addedLines, filePath, modelToUse);

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
        const modelToUse = options.model || LLM_CONFIG.DEFAULT_MODEL;
        const reviewingMessage = `\nReviewing ${filePath} using ${modelToUse} ...`;
        console.log(reviewingMessage + '\n');
        appendToReviewOutput(reviewingMessage + '\n');

        const review = await llmService.reviewCode(content, filePath, modelToUse);

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

program
  .command('genv')
  .description('Generate or append LLM API configuration to .env file')
  .option('-f, --force', 'overwrite existing .env file if it exists')
  .action(async (options) => {
    try {
      const llmConfig = `
# LLM API Configuration (supports any OpenAI-compatible endpoint)

# API base URL (e.g., http://localhost:11434 for Ollama, https://api.openai.com/v1 for OpenAI)
LLM_API_BASE_URL=http://localhost:11434

# API key (required for some providers like OpenAI, optional for local providers like Ollama)
LLM_API_KEY=

# Model configurations
LLM_DEFAULT_MODEL=codellama:7b

# Generation parameters
LLM_DEFAULT_TEMPERATURE=0.7
LLM_DEFAULT_TOP_P=0.9
LLM_DEFAULT_MAX_TOKENS=2048
LLM_REQUEST_TIMEOUT=60000

# Rate limiting (milliseconds between requests)
LLM_MIN_REQUEST_INTERVAL=500

# Code review parameters
CODE_FILE_EXTENSIONS=ts,js,py,go
`;

      const envPath = path.join(process.cwd(), '.env');

      try {
        await fs.promises.access(envPath, fs.constants.F_OK);
        if (options.force) {
          await FileService.writeContentToFile(envPath, llmConfig);
          console.log('Overwriting existing .env file with LLM API configuration...');
        } else {
          await FileService.appendContentToFile(envPath, llmConfig);
          console.log('Appended LLM API configuration to existing .env file');
        }
      } catch (error) {
        await FileService.writeContentToFile(envPath, llmConfig);
        console.log('Created new .env file with LLM API configuration');
      }
    } catch (error) {
      console.error('Error updating .env file:', error);
      process.exit(1);
    }
  });

program.parse();