# REVCD (Review Code)

A command-line utility to review code changes, built with Node.js and TypeScript.

## Installation

### From npm (recommended)

You can install the package directly from npm:

```bash
# Install globally
npm install -g revcd

# Or with yarn
yarn global add revcd
```

### From Source

After cloning the repository, you can install the CLI globally on your system:

```bash
# Install dependencies
yarn install

# Build the project
yarn build

# Link the package globally
yarn link
```

## Usage

Once installed, you can use the `revcd` command from anywhere in your terminal.

### Available Commands

- **Help**: Display available commands
  ```bash
  revcd --help
  ```

- **Review**: Review code files
  ```bash
  revcd review [options]
  ```
  Options:
  - `-m, --model <model>`: Specify the Ollama model to use for review
  - `-f, --file <file>`: Review only a specific file
  - `-a, --all`: Review all files, not just code files
  - `-h, --hunks-only`: Review only the added hunks/lines instead of entire files
  - `-s, --staged`: Review staged changes instead of unstaged changes (works with --hunks-only)

- **Hunks**: Show only the changed parts (hunks) of unstaged/uncommitted files
  ```bash
  revcd hunks [options]
  ```
  Options:
  - `-f, --file <file>`: Show hunks for a specific file only
  - `-s, --staged`: Show hunks for staged changes instead of unstaged



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

# Rate limiting (milliseconds between requests)
OLLAMA_MIN_REQUEST_INTERVAL=500
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
