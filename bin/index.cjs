#!/usr/bin/env node

const { Command } = require('commander');
const { dir } = require('tmp-promise');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Use execAsync with a custom implementation that captures both stdout and stderr
const execAsync = (command) => {
    return new Promise(async (resolve, reject) => {
        const env = { ...process.env };
        
        if (process.platform === 'win32') {
            const envVarsToCheck = [
                { name: 'PROGRAMFILES', regKey: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion', regValue: 'ProgramFilesDir' },
                { name: 'PROGRAMFILES(X86)', regKey: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion', regValue: 'ProgramFilesDir (x86)' },
                { name: 'USERPROFILE', regKey: 'HKEY_CURRENT_USER\\Volatile Environment', regValue: 'USERPROFILE' },
                { name: 'APPDATA', regKey: 'HKEY_CURRENT_USER\\Volatile Environment', regValue: 'APPDATA' },
                { name: 'LOCALAPPDATA', regKey: 'HKEY_CURRENT_USER\\Volatile Environment', regValue: 'LOCALAPPDATA' }
            ];

            for (const envVar of envVarsToCheck) {
                if (!env[envVar.name]) {
                    try {
                        // Read value from registry
                        const { stdout } = await new Promise((resolveReg, rejectReg) => {
                            exec(`reg query "${envVar.regKey}" /v "${envVar.regValue}"`, 
                                (error, stdout, stderr) => {
                                    if (error) {
                                        rejectReg(error);
                                    } else {
                                        resolveReg({ stdout, stderr });
                                    }
                                }
                            );
                        });

                        // Parse the registry output
                        const match = stdout.match(new RegExp(`${envVar.regValue.replace(/\s/g, '\\s+')}\\s+REG_[^\\s]+\\s+(.+)`));
                        if (match) {
                            // For User Shell Folders, we need to expand any environment variables in the path
                            let value = match[1].trim();
                            if (envVar.regKey.includes('User Shell Folders')) {
                                // Replace %USERPROFILE% if present
                                value = value.replace(/%([^%]+)%/g, (_, varName) => env[varName] || '');
                            }
                            env[envVar.name] = value;
                        }
                    } catch (error) {
                        // If we failed to get USERPROFILE, try a fallback using HOMEDRIVE and HOMEPATH
                        if (envVar.name === 'USERPROFILE' && env.HOMEDRIVE && env.HOMEPATH) {
                            env.USERPROFILE = env.HOMEDRIVE + env.HOMEPATH;
                        }
                        // For APPDATA and LOCALAPPDATA, try constructing from USERPROFILE if available
                        else if (envVar.name === 'APPDATA' && env.USERPROFILE) {
                            env.APPDATA = env.USERPROFILE + '\\AppData\\Roaming';
                        }
                        else if (envVar.name === 'LOCALAPPDATA' && env.USERPROFILE) {
                            env.LOCALAPPDATA = env.USERPROFILE + '\\AppData\\Local';
                        }
                    }
                }
            }
        }

        exec(command, { env }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
};

const program = new Command();

// Check if dotnet SDK is installed
async function checkDotnetInstallation() {
    try {
        await execAsync('dotnet --version');
        return true;
    } catch (error) {
        process.stderr.write('❌ Error: .NET SDK is not installed!\n');
        process.stderr.write('Please install the .NET SDK from https://dotnet.microsoft.com/download \n');
        process.exit(1);
    }
}

// Parse package-id and version (if specified as package-id@version)
function parsePackageId(packageId) {
    const parts = packageId.split('@');
    return {
        packageId: parts[0],
        version: parts.length > 1 ? parts[1] : null
    };
}

// Install dotnet tool and return the tool command name
async function installDotnetTool(packageId, toolPath, version) {
    //process.stdout.write(`📦 Installing ${packageId}...\n`);
    
    try {
        // Construct the install command with optional version
        const versionArg = version ? `--version ${version}` : '';
        const command = `dotnet tool install --tool-path "${toolPath}" ${packageId} ${versionArg}`.trim();
        
        // Execute the tool installation
        const { stdout, stderr } = await execAsync(command);
        
        // Check if there's error information in stderr
        if (stderr && stderr.trim().length > 0) {
            // If the stderr contains error messages but the process didn't exit with an error code,
            // we'll still log the warning but continue
            process.stderr.write(`⚠️  Warning during tool installation: ${stderr.trim()}\n`);
        }
        
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
            process.stderr.write(`Could not inspect tool directory: ${dirError.message}, falling back to output parsing.\n`);
        }
        
        // If we couldn't determine the tool name from files, try to parse from output
        if (!toolCommand) {
            const commandRegex = /(?:You can invoke the tool using the following command:|has the following commands:)\s+([^\s\n]+)/i;
            const match = stdout.match(commandRegex);
            
            if (match && match[1]) {
                toolCommand = match[1];
            } else {
                throw new Error(`Could not determine tool command name. Installation output: ${stdout.trim()}`);
            }
        }
        
        return toolCommand;
    } catch (error) {
        // Create a more descriptive error message including stderr if available
        const errorDetails = error.stderr 
            ? `${error.message}\nTool installation error details: ${error.stderr.trim()}`
            : error.message;
            
        // Log the error to stderr
        process.stderr.write(`❌ Failed to install tool: ${errorDetails}\n`);
        
        // Throw a new error with the enhanced details
        throw new Error(`Failed to install ${packageId}${version ? ` version ${version}` : ''}: ${errorDetails}`);
    }
}

// Run the installed dotnet tool
async function runDotnetTool(toolName, toolPath, args) {
    // On Windows, add .exe extension
    const exeName = process.platform === 'win32' ? `${toolName}.exe` : toolName;
    const toolExePath = path.join(toolPath, exeName);
    
    // Show the command that's being run with all arguments - write to stderr to avoid interfering with stdout
    //const displayCommand = `${toolName} ${args.join(' ')}`;
    //process.stdout.write(`🚀 Running: ${displayCommand}\n`);
    
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
                process.stderr.write(`❌ Error: ${error.message}\n`);
                process.exit(1);
            } finally {
                // Clean up the temporary directory
                tmpDir.cleanup();
            }
        } catch (error) {
            process.stderr.write(`❌ Error: ${error.message}\n`);
            process.exit(1);
        }
    });

// Only run the command parser when this is the main module being executed
// This prevents program.parse from being executed when the file is imported in tests
if (require.main === module) {
    program.parse(process.argv);
}

// Export functions and objects needed for testing
module.exports = {
    program,
    checkDotnetInstallation,
    parsePackageId,
    installDotnetTool,
    runDotnetTool
};