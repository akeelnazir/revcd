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

- **Review**: Review a file
  ```bash
  rcd review -f <file>
  ```

- **Git Status**: Show all uncommitted changes in the repository
  ```bash
  rcd status
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
  - `ollama.ts`: Ollama operations
  - `gitService.ts`: Git operations


## License

ISC

## Author

Akeel Nazir
