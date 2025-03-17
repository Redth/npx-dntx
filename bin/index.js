#!/usr/bin/env node
import { Command } from 'commander';
import { dir } from 'tmp-promise';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export const program = new Command();

// Check if dotnet SDK is installed
export async function checkDotnetInstallation() {
    try {
        await execAsync('dotnet --version');
        return true;
    } catch (error) {
        process.stderr.write('\x1b[31m%s\x1b[0m', '❌ Error: .NET SDK is not installed!\n');
        process.stderr.write('Please install the .NET SDK from https://dotnet.microsoft.com/download \n');
        process.exit(1);
    }
}

// Parse package-id and version (if specified as package-id@version)
export function parsePackageId(packageId) {
    const parts = packageId.split('@');
    return {
        packageId: parts[0],
        version: parts.length > 1 ? parts[1] : null
    };
}

// Install dotnet tool and return the tool command name
export async function installDotnetTool(packageId, toolPath, version) {
    console.log(`📦 Installing ${packageId}...`);
    
    try {
        // Construct the install command with optional version
        const versionArg = version ? `--version ${version}` : '';
        const command = `dotnet tool install --tool-path "${toolPath}" ${packageId} ${versionArg}`.trim();
        
        // Execute the tool installation
        const { stdout } = await execAsync(command);
        
        let toolCommand = null;
        
        // Try to find the tool by listing the directory
        try {
            const files = await fs.readdir(toolPath);
            
            if (files.length === 1) {
                // If there's only one file, it's likely the tool
                toolCommand = files[0];
                
                // On Windows, strip .exe extension
                if (process.platform === 'win32' && toolCommand.endsWith('.exe')) {
                    toolCommand = toolCommand.slice(0, -4);
                }
            } else if (files.length > 1) {
                // Try to find a likely executable (non-docs, non-config files)
                const nonDocs = files.filter(f => 
                    !f.match(/\.(md|txt|json|config)$/i) && 
                    !f.match(/^(readme|license|notice)/i)
                );
                
                if (nonDocs.length === 1) {
                    toolCommand = nonDocs[0];
                    
                    // On Windows, strip .exe extension
                    if (process.platform === 'win32' && toolCommand.endsWith('.exe')) {
                        toolCommand = toolCommand.slice(0, -4);
                    }
                }
            }
        } catch (dirError) {
            console.log(`Could not inspect tool directory: ${dirError.message}, falling back to output parsing.`);
        }
        
        // If we couldn't determine the tool name from files, try to parse from output
        if (!toolCommand) {
            const commandRegex = /(?:You can invoke the tool using the following command:|has the following commands:)\s+([^\s\n]+)/i;
            const match = stdout.match(commandRegex);
            
            if (match && match[1]) {
                toolCommand = match[1];
            } else {
                throw new Error('Could not determine tool command name');
            }
        }
        
        return toolCommand;
    } catch (error) {
        console.error('Failed to install tool:', error.stderr || error.message);
        throw error;
    }
}

// Run the installed dotnet tool
export async function runDotnetTool(toolName, toolPath, args) {
    // On Windows, add .exe extension
    const exeName = process.platform === 'win32' ? `${toolName}.exe` : toolName;
    const toolExePath = path.join(toolPath, exeName);
    
    // Show the command that's being run with all arguments - write to stderr to avoid interfering with stdout
    const displayCommand = `${toolName} ${args.join(' ')}`;
    process.stdout.write(`🚀 Running: ${displayCommand}\n`);
    
    return new Promise((resolve, reject) => {
        // Use spawn with direct stdio inheritance for transparent passthrough
        const childProcess = spawn(toolExePath, args, {
            stdio: 'inherit',
            shell: false,
            windowsHide: true
        });
        
        // Handle process exit
        childProcess.on('exit', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Tool exited with code ${code}`));
            }
        });
        
        // Handle process errors
        childProcess.on('error', (err) => {
            reject(err);
        });
    });
}

// Set up the command-line interface
program
    .name('npx dntx')
    .description('Temporary .NET tool executor')
    .argument('<package-id>', 'NuGet package ID of the dotnet tool, optionally with version (e.g., package-id@1.2.3)')
    .allowUnknownOption(true)
    .action(async (packageIdWithVersion) => {
        try {
            // Check if dotnet is installed
            await checkDotnetInstallation();
            
            // Parse package-id and version
            const { packageId, version } = parsePackageId(packageIdWithVersion);
            
            // Create a temporary directory for the tool
            const tmpDir = await dir({ unsafeCleanup: true });
            
            try {
                // Install the tool
                const toolName = await installDotnetTool(packageId, tmpDir.path, version);
                
                // Get any arguments to pass to the tool (everything after the package-id)
                const toolArgs = program.args.slice(1);
                
                // Run the tool with the provided arguments
                await runDotnetTool(toolName, tmpDir.path, toolArgs);
            } catch (error) {
                console.error('\x1b[31m%s\x1b[0m', '❌ Error:', error.message);
                process.exit(1);
            } finally {
                // Clean up the temporary directory
                tmpDir.cleanup();
            }
        } catch (error) {
            console.error('\x1b[31m%s\x1b[0m', '❌ Error:', error.message);
            process.exit(1);
        }
    });

// Only run main if this is the main module
const isMainModule = typeof require !== 'undefined' ? 
    require.main === module : 
    import.meta.url === (process.argv[1] ? new URL(`file://${process.argv[1]}`).href : undefined);

if (isMainModule) {
    program.parse(process.argv);
}