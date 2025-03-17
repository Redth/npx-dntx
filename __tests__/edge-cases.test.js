import { jest } from '@jest/globals';
import { installDotnetTool, runDotnetTool } from '../bin/index.js';
import path from 'path';
import fs from 'fs/promises';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

// Global test timeout (tools can take some time to install)
jest.setTimeout(60000);

// Helper to create a temp directory
async function createTempDir() {
  const tmpDir = path.join(os.tmpdir(), `dntx-edge-test-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

describe('dntx edge cases', () => {
  let dotnetAvailable = false;
  let tempDir;
  
  beforeAll(async () => {
    try {
      await execAsync('dotnet --version');
      dotnetAvailable = true;
    } catch (err) {
      console.warn('Skipping edge case tests: .NET SDK not detected');
    }
  });

  beforeEach(async () => {
    if (dotnetAvailable) {
      tempDir = await createTempDir();
    }
  });

  afterEach(async () => {
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`Failed to clean up temp dir ${tempDir}: ${err.message}`);
      }
    }
  });

  it('should handle tools that create multiple files in tool directory', async () => {
    if (!dotnetAvailable) {
      return;
    }
    
    // dotnet-ef is known to install multiple files (both ef.dll and the executable)
    const toolName = await installDotnetTool('dotnet-ef', tempDir);
    
    // Verify we got a tool name back
    expect(toolName).toBeTruthy();
    
    // Check that the directory has multiple files
    const files = await fs.readdir(tempDir);
    expect(files.length).toBeGreaterThan(1);
    
    // Check that the executable file exists
    const exeName = process.platform === 'win32' ? `${toolName}.exe` : toolName;
    const stats = await fs.stat(path.join(tempDir, exeName));
    expect(stats.isFile()).toBe(true);
  });
});