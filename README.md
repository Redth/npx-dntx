# dntx

A simple node CLI tool to temporarily install and run .NET tools via npx. No global installation required!


https://github.com/user-attachments/assets/48da0e8b-bc7f-446a-bbfa-155961f98c40


## Why?
There's currently no way to [temporarily install](https://github.com/dotnet/sdk/issues/47517) a .NET tool and have it execute in a single command like NPX allows for node projects.  

## How?
When you run the tool, it captures the first arg passed into it as the dotnet tool NuGet Package Id and attempts to install it to a local temporary path (eg: `dotnet tool install --tool-path "/tmp/abc123" NuGetPackageIdHere --version=1.2.3`).  Once it's installed, it infers the executable command from the installed location and runs the process, passing along any remaining args from the original call.  Once the process exits, the temporary installed dotnet tool files are cleaned up.

## Quick Start

Run any .NET tool directly without installation:

```bash
npx dntx[@version] <package-id> [arguments]
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
npx dntx androidsdk.tool
```

2. Run a tool with a specific version:
```bash
npx dntx androidsdk.tool@0.19.0
```

3. Run a tool with arguments:
```bash
npx dntx androidsdk.tool sdk info --format=json
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

## Development

### Setup

1. Clone the repository:
```bash
git clone https://github.com/redth/npx-dntx.git
cd npx-dntx
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
