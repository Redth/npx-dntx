# dntx

A simple CLI tool to temporarily install and run .NET tools via npx. No global installation required!

## Quick Start

Run any .NET tool directly without installation:

```bash
npx dntx@latest <package-id> [arguments]
```

For example:
```bash
# Run the HTTP REPL tool
npx dntx@latest microsoft.dotnet-httprepl

# Run a specific version of a tool
npx dntx@latest microsoft.dotnet-httprepl@6.0.0

# Run with arguments
npx dntx@latest microsoft.dotnet-httprepl https://api.example.com
```

## Prerequisites

- Node.js (>= 14.0.0)
- .NET SDK (any version)

## Usage

You can run any .NET tool directly using npx without installing it globally:

```bash
npx dntx <package-id> [arguments]
```

### Examples

1. Run a tool without version specification:
```bash
npx dntx microsoft.dotnet-httprepl
```

2. Run a tool with a specific version:
```bash
npx dntx microsoft.dotnet-httprepl@6.0.0
```

3. Run a tool with arguments:
```bash
npx dntx microsoft.dotnet-httprepl https://api.example.com
```

### How It Works

1. Checks if .NET SDK is installed
2. Creates a temporary directory
3. Installs the specified .NET tool (with version if specified)
4. Runs the tool with any provided arguments
5. Automatically cleans up after execution

## Features

- ✨ No global installation required
- 🎯 Version pinning support (`package-id@version`)
- 🧹 Automatic cleanup
- 🔄 Works cross-platform
- 🚀 Simple and intuitive interface

## Common .NET Tools

Here are some popular .NET tools you can try:

- `microsoft.dotnet-httprepl` - HTTP REPL command-line tool
- `dotnet-ef` - Entity Framework Core tools
- `dotnet-outdated-tool` - Check for outdated NuGet packages
- `dotnet-format` - Code formatter
- `dotnet-trace` - Performance analysis tool

## Development

### Setup

1. Clone the repository:
```bash
git clone https://github.com/redth/npxdotnettool.git
cd npxdotnettool
```

2. Install dependencies:
```bash
npm install
```

### Available Scripts

- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run build` - Run build process (currently runs tests)
- `npm run prepare-publish` - Prepare for publishing (runs build and shows included files)

### Running Tests

The project uses Jest for testing. Tests run across multiple Node.js versions and operating systems in CI.

```bash
npm test
```

## Continuous Integration

GitHub Actions workflows automatically run tests on:
- Multiple operating systems (Windows, macOS, Linux)
- Multiple Node.js versions (14.x, 16.x, 18.x, 20.x)
- Multiple .NET SDK versions (6.0.x, 7.0.x, 8.0.x)

## Publishing

### Preparing for Release

1. Update version and create git tag:
```bash
npm version patch  # or minor/major
```

2. Preview what will be published:
```bash
npm run prepare-publish
```

### Publishing to npm

#### Manual Publishing
```bash
npm login
npm publish
```

#### Automated Publishing via GitHub

1. Create an npm access token:
```bash
npm token create
```

2. Add the token to GitHub:
   - Go to your repository's Settings
   - Navigate to Secrets and variables > Actions
   - Create a new secret named `NPM_TOKEN`
   - Paste your npm token as the value

3. Create a new release on GitHub:
   - Go to Releases > Draft a new release
   - Choose the tag created by npm version
   - Add release notes
   - Publish the release

The GitHub Actions workflow will automatically publish to npm when the release is created.

## Error Handling

The tool provides clear error messages for common issues:

- Missing .NET SDK installation
- Invalid package IDs
- Non-existent versions
- Tool execution failures

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Jon Dick (redth) 