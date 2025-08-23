# RCD (Review Code Daemon)

A command-line utility built with Node.js and TypeScript.

## Installation

After cloning the repository, you can install the CLI globally on your system:

```bash
# Build the project
yarn build

# Link the package globally
yarn link
```

## Usage

Once installed, you can use the `rcd` command from anywhere in your terminal.

### Available Commands

- **Help**: Display available commands
  ```bash
  rcd --help
  ```

- **Hello**: Say hello
  ```bash
  rcd hello
  rcd hello --name YourName
  ```

- **List Files**: List files in a directory
  ```bash
  rcd ls
  rcd ls /path/to/directory
  ```

- **View File Contents**: Show file contents
  ```bash
  rcd cat filename.txt
  ```

- **System Information**: Show system information
  ```bash
  rcd sysinfo
  ```

- **Directory Information**: Show current directory information
  ```bash
  rcd pwd
  ```

- **Git Changes**: Show changes in the latest git commit
  ```bash
  rcd changes
  ```

- **Git Status**: Show all uncommitted changes in the repository
  ```bash
  rcd status
  ```

- **Git Staged Diff**: Show the full diff output for staged changes
  ```bash
  rcd staged-diff
  ```

- **Git File Diff**: Show the diff content for a specific uncommitted file
  ```bash
  rcd diff <file>                  # Show unstaged changes for a file
  rcd diff <file> --staged         # Show staged changes for a file
  rcd diff <file> --plain          # Show file content without diff format (no + or - prefixes)
  rcd diff <file> --staged --plain # Show staged content without diff format
  ```

## Environment Variables

The application uses environment variables for configuration. You can set these in a `.env` file in the root directory or as system environment variables.

### Ollama Configuration

```
# API base URL
OLLAMA_API_BASE_URL=http://localhost:11434

# Model configurations
OLLAMA_DEFAULT_MODEL=llama3
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Generation parameters
OLLAMA_DEFAULT_TEMPERATURE=0.7
OLLAMA_DEFAULT_TOP_P=0.9
OLLAMA_DEFAULT_MAX_TOKENS=2048
```

A `.env.example` file is provided as a template.

## Development

### Prerequisites

- Node.js
- Yarn

### Setup

```bash
# Install dependencies
yarn install

# Build the project
yarn build

# Run in development mode
yarn dev
```

### Project Structure

- `src/index.ts`: Main entry point for the CLI
- `src/services/`: Service modules
  - `fileService.ts`: File operations
  - `systemService.ts`: System information
  - `gitService.ts`: Git operations

## Using as a Git Hook

You can use the `changes` command as a git hook to automatically show the changes in the latest commit after each commit. Here's how to set it up:

### Post-Commit Hook

1. Create a file named `post-commit` in your repository's `.git/hooks/` directory:

```bash
#!/bin/sh

# Run the rcd changes command to show the latest commit changes
rcd changes
```

2. Make the hook executable:

```bash
chmod +x .git/hooks/post-commit
```

Now, every time you make a commit, the `rcd changes` command will run automatically and show you the changes in that commit.

## License

ISC

## Author

Akeel Nazir
