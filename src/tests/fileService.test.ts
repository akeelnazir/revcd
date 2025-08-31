import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { FileService } from '../services/fileService';
import * as os from 'os';

const TEST_DIR = join(os.tmpdir(), 'revcd-test-dir');
const TEST_FILE = join(TEST_DIR, 'test-file.txt');
const TEST_CONTENT = 'Test content';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function assert(condition: boolean, message: string): Promise<void> {
  totalTests++;
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failedTests++;
  }
}

async function assertRejects(promise: Promise<any>, errorMessageContains: string): Promise<void> {
  try {
    await promise;
    await assert(false, `Expected promise to reject with message containing "${errorMessageContains}"`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await assert(
      errorMessage.includes(errorMessageContains),
      `Error message "${errorMessage}" should contain "${errorMessageContains}"`
    );
  }
}

async function setup(): Promise<void> {
  try {
    await fsPromises.mkdir(TEST_DIR, { recursive: true });
    console.log(`Test directory created: ${TEST_DIR}`);

    try {
      await fsPromises.unlink(TEST_FILE).catch(() => { });
      console.log(`Cleaned up existing test file: ${TEST_FILE}`);
    } catch (cleanupError) {
      // Ignore errors if file doesn't exist
    }
  } catch (error) {
    console.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Test setup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function teardown(): Promise<void> {
  try {
    const testFiles = [
      TEST_FILE,
      join(process.cwd(), 'test-review.md'),
      join(process.cwd(), 'REVIEW.md')
    ];

    for (const file of testFiles) {
      try {
        await fsPromises.unlink(file).catch(() => { });
      } catch (unlinkError) {
        // Ignore errors if file doesn't exist
      }
    }

    console.log(`Test files cleaned up`);
  } catch (error) {
    console.error(`Teardown failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function testAppendOrWriteFile(): Promise<void> {
  await assertRejects(
    FileService.appendOrWriteFile('', TEST_CONTENT, 'write'),
    'File path and content cannot be empty'
  );

  await assertRejects(
    FileService.appendOrWriteFile(TEST_FILE, '', 'write'),
    'File path and content cannot be empty'
  );

  try {
    await FileService.appendOrWriteFile(TEST_FILE, TEST_CONTENT, 'write');
    const content = await fsPromises.readFile(TEST_FILE, 'utf8');
    await assert(content === TEST_CONTENT, 'Content should be written to file in write mode');
  } catch (error) {
    await assert(false, `Write mode test failed: ${error}`);
  }

  try {
    const additionalContent = '\nAdditional content';
    await FileService.appendOrWriteFile(TEST_FILE, additionalContent, 'append');
    const content = await fsPromises.readFile(TEST_FILE, 'utf8');
    await assert(
      content === TEST_CONTENT + additionalContent,
      'Content should be appended to file in append mode'
    );
  } catch (error) {
    await assert(false, `Append mode test failed: ${error}`);
  }
}

async function testAppendContentToFile(): Promise<void> {
  const initialContent = 'Initial content';
  const appendContent = '\nAppended content';

  try {
    await fsPromises.writeFile(TEST_FILE, initialContent, 'utf8');
    await FileService.appendContentToFile(TEST_FILE, appendContent);

    const content = await fsPromises.readFile(TEST_FILE, 'utf8');
    await assert(
      content === initialContent + appendContent,
      'Content should be appended to existing file'
    );
  } catch (error) {
    await assert(false, `appendContentToFile test failed: ${error}`);
  }
}

async function testWriteContentToFile(): Promise<void> {
  const initialContent = 'Initial content';
  const newContent = 'New content';

  try {
    await fsPromises.writeFile(TEST_FILE, initialContent, 'utf8');
    await FileService.writeContentToFile(TEST_FILE, newContent);

    const content = await fsPromises.readFile(TEST_FILE, 'utf8');
    await assert(
      content === newContent,
      'Content should overwrite existing file'
    );
  } catch (error) {
    await assert(false, `writeContentToFile test failed: ${error}`);
  }
}

async function testWriteReviewOutputToFile(): Promise<void> {
  await assertRejects(
    FileService.writeReviewOutputToFile('', 'output.md'),
    'Review output must be a non-empty string'
  );

  await assertRejects(
    FileService.writeReviewOutputToFile('content', ''),
    'Output path cannot be empty'
  );

  const reviewContent = 'This is a review';
  const outputPath = 'test-review.md';

  try {
    const originalWriteContentToFile = FileService.writeContentToFile;

    let capturedPath = '';
    let capturedContent = '';

    FileService.writeContentToFile = async (path, content) => {
      capturedPath = path;
      capturedContent = content;
      return Promise.resolve();
    };

    await FileService.writeReviewOutputToFile(reviewContent, outputPath);

    await assert(
      capturedPath.endsWith(outputPath),
      `Output path should end with ${outputPath}, got ${capturedPath}`
    );

    await assert(
      capturedContent.includes('# Code Review Output') &&
      capturedContent.includes('Generated on:') &&
      capturedContent.includes(reviewContent),
      'Review output should be formatted correctly'
    );

    FileService.writeContentToFile = originalWriteContentToFile;
  } catch (error) {
    await assert(false, `writeReviewOutputToFile test with custom path failed: ${error}`);
  }

  try {
    const defaultOutputPath = join(process.cwd(), 'REVIEW.md');
    const originalWriteContentToFile = FileService.writeContentToFile;

    FileService.writeContentToFile = async () => Promise.resolve();

    await FileService.writeReviewOutputToFile(reviewContent);
    await assert(true, 'Default output path should work');

    FileService.writeContentToFile = originalWriteContentToFile;
  } catch (error) {
    await assert(false, `writeReviewOutputToFile test with default path failed: ${error}`);
  }
}

async function testGetFileContentByLineRange(): Promise<void> {
  const emptyPathResult = await FileService.getFileContentByLineRange('', 1, 10);
  await assert(emptyPathResult === null, 'Empty file path should return null');

  const invalidStartResult = await FileService.getFileContentByLineRange(TEST_FILE, 0, 10);
  await assert(invalidStartResult === null, 'Invalid start line should return null');

  const invalidRangeResult = await FileService.getFileContentByLineRange(TEST_FILE, 10, 5);
  await assert(invalidRangeResult === null, 'Invalid line range should return null');

  const testLines = [
    'Line 1',
    'Line 2',
    'Line 3',
    'Line 4',
    'Line 5'
  ];

  try {
    await fsPromises.writeFile(TEST_FILE, testLines.join('\n'), 'utf8');

    const validRangeResult = await FileService.getFileContentByLineRange(TEST_FILE, 2, 4);
    await assert(
      validRangeResult === 'Line 2\nLine 3\nLine 4',
      'Valid line range should return correct content'
    );

    const exceedingRangeResult = await FileService.getFileContentByLineRange(TEST_FILE, 4, 10);
    await assert(
      exceedingRangeResult === 'Line 4\nLine 5',
      'Range exceeding file length should return available content'
    );

    const exceedingStartResult = await FileService.getFileContentByLineRange(TEST_FILE, 10, 15);
    await assert(
      exceedingStartResult === null,
      'Start line exceeding file length should return null'
    );
  } catch (error) {
    await assert(false, `getFileContentByLineRange test failed: ${error}`);
  }
}

async function runTests() {
  console.log('\n=== FileService Tests ===\n');

  try {
    await setup();

    console.log('\nTesting appendOrWriteFile:');
    await testAppendOrWriteFile();

    console.log('\nTesting appendContentToFile:');
    await testAppendContentToFile();

    console.log('\nTesting writeContentToFile:');
    await testWriteContentToFile();

    console.log('\nTesting writeReviewOutputToFile:');
    await testWriteReviewOutputToFile();

    console.log('\nTesting getFileContentByLineRange:');
    await testGetFileContentByLineRange();

  } catch (error) {
    console.error(`Unexpected error in tests: ${error}`);
  } finally {
    await teardown();

    console.log('\n=== Test Summary ===');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  }
}

runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
