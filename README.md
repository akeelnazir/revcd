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

## License

ISC

## Author

Akeel Nazir
