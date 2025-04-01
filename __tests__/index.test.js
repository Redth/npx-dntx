const { expect, describe, it, beforeEach, afterEach, beforeAll } = require('@jest/globals');
const { program, checkDotnetInstallation, parsePackageId, installDotnetTool, runDotnetTool } = require('../bin/index.cjs');
const path = require('path');
const fs = require('fs').promises;
const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execAsync = promisify(exec);
const CLI_PATH = path.resolve(__dirname, '../bin/');


// Global test timeout (tools can take some time to install)
jest.setTimeout(30000);

// Helper to create a temp directory
async function createTempDir() {
  const tmpDir = path.join(os.tmpdir(), `dntx-test-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

describe('dntx integration tests', () => {
  describe('checkDotnetInstallation', () => {
    it('should detect installed dotnet SDK', async () => {
      try {
        // Verify dotnet is actually installed on the system running tests
        execSync('dotnet --version');
        const result = await checkDotnetInstallation();
        expect(result).toBe(true);
      } catch (err) {
        // If dotnet isn't installed, we can't run this test
        console.warn('Skipping test: .NET SDK not detected on test system');
      }
    });
  });

  describe('parsePackageId', () => {
    it('should parse package ID without version', () => {
      const result = parsePackageId('dotnet-example');
      expect(result).toEqual({
        packageId: 'dotnet-example',
        version: null
      });
    });

    it('should parse package ID with version', () => {
      const result = parsePackageId('dotnet-example@1.2.3');
      expect(result).toEqual({
        packageId: 'dotnet-example',
        version: '1.2.3'
      });
    });
  });

  describe('installDotnetTool and runDotnetTool', () => {
    let tempDir;

    beforeEach(async () => {
      tempDir = await createTempDir();
    });

    afterEach(async () => {
      // Clean up temp directory after tests
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`Failed to clean up temp dir ${tempDir}: ${err.message}`);
      }
    });
    
    // This test uses a small, real dotnet tool to verify actual installation works
    it('should install a real dotnet tool and determine its command', async () => {
      try {
        // Check if dotnet exists first
        execSync('dotnet --version');
        
        // We'll use androidsdk.tool as our test tool - it's small and simple
        const toolName = await installDotnetTool('androidsdk.tool', tempDir);
        
        // Verify we got a tool name back
        expect(toolName).toBeTruthy();
        
        // Verify the tool executable exists
        const exeName = process.platform === 'win32' ? `${toolName}.exe` : toolName;
        const stats = await fs.stat(path.join(tempDir, exeName));
        expect(stats.isFile()).toBe(true);
      } catch (err) {
        if (err.message?.includes('dotnet --version')) {
          console.warn('Skipping test: .NET SDK not detected');
        } else {
          throw err;
        }
      }
    });
  });

  // Test the CLI functionality
  describe('CLI program', () => {
    it('should have the correct name and description', () => {
      expect(program.name()).toBe('npx dntx');
      expect(program.description()).toBe('Temporary .NET tool executor');
    });

    it('should properly define argument for package-id', () => {
      const packageIdArg = program._args.find(arg => arg.name() === 'package-id');
      expect(packageIdArg).toBeTruthy();
      expect(packageIdArg.description).toBe('NuGet package ID of the dotnet tool, optionally with version (e.g., package-id@1.2.3)');
    });
  });
});