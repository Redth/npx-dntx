#!/usr/bin/env node

import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import { dir as tmpDir } from 'tmp-promise';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export const program = new Command();

// Parse package ID and version
function parsePackageId(input) {
    const match = input.match(/^([^@]+)(?:@(.+))?$/);
    return {
        packageId: match[1],
        version: match[2] || null
    };
}

// Check if dotnet is installed
export async function checkDotnetInstallation() {
    try {
        await execAsync('dotnet --version');
        return true;
    } catch (error) {
        console.error('❌ .NET SDK is not installed or not found in PATH');
        console.error('Please install the .NET SDK from: https://dotnet.microsoft.com/download');
        process.exit(1);
        return false; // This line will never be reached
    }
}

// Install dotnet tool
export async function installDotnetTool(packageId, tempDir) {
    try {
        const { packageId: id, version } = parsePackageId(packageId);
        console.log(`📦 Installing ${id}${version ? ` (version ${version})` : ''}...`);
        const command = `dotnet tool install --tool-path "${tempDir}" ${id}${version ? ` --version ${version}` : ''}`;
        const { stdout } = await execAsync(command);
        console.log('✅ Tool installed successfully');
    } catch (error) {
        console.error('❌ Failed to install tool:', error.message);
        process.exit(1);
    }
}

// Run the tool with provided arguments
export async function runDotnetTool(packageId, toolPath, args) {
    try {
        // Get the tool name from the package ID (usually the last part after the last dot)
        const { packageId: id } = parsePackageId(packageId);
        const toolName = id.split('.').pop();
        const toolExePath = path.join(toolPath, process.platform === 'win32' ? `${toolName}.exe` : toolName);
        
        console.log(`🚀 Running ${toolName}...`);
        const command = `"${toolExePath}" ${args.join(' ')}`;
        const { stdout, stderr } = await execAsync(command, {
            stdio: 'inherit'
        });
        
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
    } catch (error) {
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
        process.exit(1);
    }
}

// Setup program
program
    .name('dntx')
    .description('Temporarily install and run a .NET tool')
    .argument('<package-id>', 'NuGet package ID of the .NET tool (optionally with version, e.g. package-id@1.2.3)')
    .allowUnknownOption(true)
    .action(async (packageId) => {
        let cleanup = null;
        let tempDirResult = null;

        try {
            // Get all arguments after the package ID
            const toolArgs = process.argv.slice(3);

            // Check for dotnet SDK
            await checkDotnetInstallation();

            // Create temporary directory
            tempDirResult = await tmpDir({
                unsafeCleanup: true
            });
            cleanup = tempDirResult.cleanup;

            // Install the tool
            await installDotnetTool(packageId, tempDirResult.path);

            // Run the tool
            await runDotnetTool(packageId, tempDirResult.path, toolArgs);
        } catch (error) {
            if (error.message !== 'Process exit') {
                console.error('❌ Error:', error.message);
            }
            process.exit(1);
        } finally {
            if (cleanup) {
                console.log('🧹 Cleaning up...');
                await cleanup();
            }
        }
    });

// Only run main if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
    program.parse(process.argv);
} 