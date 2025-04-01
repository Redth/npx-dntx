const { expect, describe, it, beforeEach, afterEach, beforeAll } = require('@jest/globals');
const path = require('path');
const fs = require('fs').promises;
const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execAsync = promisify(exec);
const CLI_PATH = path.resolve(__dirname, '../bin/index.cjs');

// Global test timeout (CLI operations can take time)
jest.setTimeout(60000);

describe('dntx CLI end-to-end', () => {
  // Skip all tests if dotnet is not installed
  let dotnetAvailable = false;
  
  beforeAll(async () => {
    try {
      await execAsync('dotnet --version');
      dotnetAvailable = true;
    } catch (err) {
      console.warn('Skipping CLI tests: .NET SDK not detected');
    }
  });
  
  it('should show error when package ID is not provided', async () => {
    if (!dotnetAvailable) {
      return;
    }
    
    try {
      await execAsync(`node ${CLI_PATH}`);
      fail('Should have thrown error for missing required argument');
    } catch (err) {
      expect(err.stderr).toContain('error: missing required argument');
    }
  });

  it('should show help information with --help flag', async () => {
    if (!dotnetAvailable) {
      return;
    }
    
    const { stdout } = await execAsync(`node ${CLI_PATH} --help`);
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('npx dntx');
    expect(stdout).toContain('Temporary .NET tool executor');
    expect(stdout).toContain('<package-id>');
  });
  
  it('should install and run a real dotnet tool', async () => {
    if (!dotnetAvailable) {
      return;
    }
    
    // Use androidsdk.tool with --version flag as it's small and exits quickly
    const { stdout, stderr } = await execAsync(`node ${CLI_PATH} androidsdk.tool sdk info --format=json`);
    
    // Check for expected output that indicates successful execution
    const combinedOutput = stdout + stderr;
    
    // Should mention running the tool
    expect(combinedOutput).toContain('SdkInfo');
    
    // The tool should output its version
    // (We don't check the specific version as it may change over time)
    // This verifies the tool actually ran and produced output
  });
  
  it('should handle package with specific version', async () => {
    if (!dotnetAvailable) {
      return;
    }
    
    // Use a specific version of a tool
    const { stdout, stderr } = await execAsync(`node ${CLI_PATH} androidsdk.tool@0.19.0 sdk info --format=json`);
    
    const combinedOutput = stdout + stderr;
    expect(combinedOutput).toContain('SdkInfo');
  });
  
  // This test ensures the CLI handles failure correctly
  it('should handle non-existent package gracefully', async () => {
    if (!dotnetAvailable) {
      return;
    }
    
    try {
      await execAsync(`node ${CLI_PATH} this-package-does-not-exist-really`);
      fail('Should have failed with non-existent package');
    } catch (err) {
      expect(err.stderr).toContain('Error');
      // The dotnet CLI will produce an error about not finding the package
      expect(err.stderr).toContain('not found');
    }
  });
});