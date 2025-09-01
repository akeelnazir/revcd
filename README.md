# REVCD (Review Code)

A command-line utility to list and review git commit changes, built with Node.js and TypeScript. This tool uses Ollama's AI models to provide instant feedback on your code changes, thus helping you improve your code quality. The generated feedback is displayed in the terminal and saved to a file named `REVIEW.md`.

Choose your preferred coding model from [Ollama](https://ollama.com/search?q=coder) to use with REVCD. In our testing, we've used both `codellama:7b` and `qwen2.5-coder:3b`, but you can select any model you prefer. The `qwen2.5-coder:3b` model performs faster and requires less memory than `codellama:7b` as it belongs to a newer generation of models.

## Features

- **Commit Message Generation**: Automatically suggests descriptive commit messages based on your code changes
- **AI-Powered Code Reviews**: Get instant feedback on your code changes using Ollama's AI models. Reviews include:
  * Mermaid sequence diagram if the code is deemed complex enough
  * Code quality assessment
  * Performance optimization suggestions
  * Security vulnerability detection
  * Best practices recommendations
  * Lists code smells
  * Improved code alternatives
- **Selective Review**: Choose to review specific files, line ranges, or only changed parts (hunks)
- **Staged & Unstaged Changes**: Review both staged and unstaged changes in your git repository
- **Language Support**: Built-in support for TypeScript, JavaScript, Python, Go, and configurable for other languages
- **Simple CLI Interface**: Easy-to-use command-line interface with intuitive options
- **Local AI Processing**: Uses Ollama for local AI processing, keeping your code private and secure
- **Customizable**: Configure AI parameters and code review settings through environment variables

### Prerequisites

- Node.js (v16 or higher)
- Ollama

#### Ollama installation

Using Docker:

```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
docker exec -it ollama ollama run codellama:7b
```

Using Homebrew:

```bash
brew install ollama
brew services start ollama
ollama run codellama:7b
```

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

- **Review**: Review code files and changes
  ```bash
  revcd review [options]
  ```
  Options:
  - `-f, --file <file>`: Review only a specific file
  - `-l, --lines <range>`: Review only a specific line range in format L:n-m (e.g., L:10-20) (must be used with --file)
  - `-h, --hunks-only`: Review only the added hunks/lines instead of entire files
  - `-s, --staged`: Review staged changes instead of unstaged changes (works with --hunks-only)
  - `-a, --all`: Review all files, not just code files
  - `-m, --model <model>`: Specify the Ollama model to use for review

- **Hunks**: Show only the changed parts (hunks) of unstaged/uncommitted files
  ```bash
  revcd hunks [options]
  ```
  Options:
  - `-f, --file <file>`: Show hunks for a specific file only
  - `-s, --staged`: Show hunks for staged changes instead of unstaged

- **Generate Env**: Copy the example environment file to your current directory
  ```bash
  revcd genv [options]
  ```
  Options:
  - `-f, --force`: Overwrite existing .env file if it exists


## Environment Variables

The application uses environment variables for configuration. You can set these in a `.env` file in the root directory or as system environment variables.

### Ollama Configuration

```
# API base URL
OLLAMA_API_BASE_URL=http://localhost:11434

# Model configurations
OLLAMA_DEFAULT_MODEL=codellama:7b

# Generation parameters
OLLAMA_DEFAULT_TEMPERATURE=0.7
OLLAMA_DEFAULT_TOP_P=0.9
OLLAMA_DEFAULT_MAX_TOKENS=2048

# Rate limiting (milliseconds between requests)
OLLAMA_MIN_REQUEST_INTERVAL=500

# Code review parameters
CODE_FILE_EXTENSIONS=ts,js,py,go
```

A `.env.example` file is provided as a template.

## Development

### Prerequisites

- Node.js (v16 or higher)
- Ollama
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
  - `gitService.ts`: Git operations for retrieving commit changes
  - `ollamaService.ts`: Ollama AI operations for code review
  - `index.ts`: Service exports
- `src/config/`: Configuration modules
  - `codeReview.config.ts`: Code review settings
  - `ollama.config.ts`: Ollama API configuration
  - `index.ts`: Configuration exports
- `src/utils/`: Utility modules
  - `languageMap.ts`: Programming language detection and mapping
  - `index.ts`: Utility exports
- `src/tests/`: Test modules
  - `languageMap.test.ts`: Tests for language mapping functionality


## License

ISC

## Author

Akeel Nazir
