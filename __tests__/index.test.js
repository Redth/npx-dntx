import { jest } from '@jest/globals';
import path from 'path';

// Mock dependencies
const mockExec = jest.fn();
jest.mock('child_process', () => ({
    exec: mockExec
}));

const mockDir = jest.fn();
jest.mock('tmp-promise', () => ({
    dir: mockDir
}));

// Mock Commander
const mockCommand = {
    name: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    argument: jest.fn().mockReturnThis(),
    allowUnknownOption: jest.fn().mockReturnThis(),
    action: jest.fn().mockReturnThis(),
    parseAsync: jest.fn().mockResolvedValue(undefined),
    parse: jest.fn().mockReturnThis()
};

jest.mock('commander', () => ({
    Command: jest.fn().mockImplementation(() => mockCommand)
}));

// Mock promisify to return a function that wraps our mock
jest.mock('util', () => ({
    promisify: (fn) => (...args) => new Promise((resolve, reject) => {
        const callback = (error, result) => {
            if (error) {
                error.stdout = result?.stdout || '';
                error.stderr = result?.stderr || '';
                reject(error);
            } else {
                resolve({ stdout: result?.stdout || '', stderr: result?.stderr || '' });
            }
        };
        if (args.length === 3 && typeof args[1] === 'object') {
            fn(args[0], args[1], callback);
        } else {
            fn(args[0], callback);
        }
    })
}));

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

// Mock path
const mockTempPath = '/tmp/mock-path';
const mockCleanup = jest.fn();

// Reset all mocks before each test
beforeEach(() => {
    jest.resetModules();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
    mockExec.mockClear();
    mockDir.mockClear();
    mockCleanup.mockClear();
    mockCommand.action.mockClear();
    mockCommand.parseAsync.mockClear();
    mockCommand.parse.mockClear();

    // Setup default mock implementations
    mockDir.mockResolvedValue({ path: mockTempPath, cleanup: mockCleanup });
});

describe('Dotnet Tool Runner', () => {
    describe('checkDotnetInstallation', () => {
        test('should pass when dotnet is installed', async () => {
            mockExec.mockImplementation((cmd, callback) => {
                expect(cmd).toBe('dotnet --version');
                callback(null, { stdout: 'dotnet version x.y.z' });
            });

            const { checkDotnetInstallation } = await import('../bin/index.js');
            await expect(checkDotnetInstallation()).resolves.toBe(true);
        });

        test('should fail when dotnet is not installed', async () => {
            const error = new Error('dotnet not found');
            error.stdout = '';
            error.stderr = error.message;
            mockExec.mockImplementation((cmd, callback) => {
                expect(cmd).toBe('dotnet --version');
                callback(error, { stdout: '', stderr: error.message });
                expect(mockConsoleError).toHaveBeenNthCalledWith(1, '❌ .NET SDK is not installed or not found in PATH');
                expect(mockConsoleError).toHaveBeenNthCalledWith(2, 'Please install the .NET SDK from: https://dotnet.microsoft.com/download');
                expect(mockProcessExit).toHaveBeenCalledWith(1);
            });

            const { checkDotnetInstallation } = await import('../bin/index.js');
            await checkDotnetInstallation();
        });
    });

    describe('installDotnetTool', () => {
        test('should successfully install a tool', async () => {
            mockExec.mockImplementation((cmd, callback) => {
                expect(cmd).toBe(`dotnet tool install --tool-path "${mockTempPath}" test-tool`);
                callback(null, { stdout: 'Tool installed successfully', stderr: '' });
                expect(mockConsoleLog).toHaveBeenNthCalledWith(1, '📦 Installing test-tool...');
                expect(mockConsoleLog).toHaveBeenNthCalledWith(2, '✅ Tool installed successfully');
            });

            const { installDotnetTool } = await import('../bin/index.js');
            await installDotnetTool('test-tool', mockTempPath);
        });

        test('should successfully install a tool with specific version', async () => {
            mockExec.mockImplementation((cmd, callback) => {
                expect(cmd).toBe(`dotnet tool install --tool-path "${mockTempPath}" test-tool --version 1.2.3`);
                callback(null, { stdout: 'Tool installed successfully', stderr: '' });
                expect(mockConsoleLog).toHaveBeenNthCalledWith(1, '📦 Installing test-tool (version 1.2.3)...');
                expect(mockConsoleLog).toHaveBeenNthCalledWith(2, '✅ Tool installed successfully');
            });

            const { installDotnetTool } = await import('../bin/index.js');
            await installDotnetTool('test-tool@1.2.3', mockTempPath);
        });

        test('should handle installation failures', async () => {
            const errorMessage = 'Command failed: dotnet tool install --tool-path "/tmp/mock-path" invalid-tool\ninvalid-tool is not found in NuGet feeds https://api.nuget.org/v3/index.json, https://pkgs.dev.azure.com/xamarin/public/_packaging/maui-nightly/nuget/v3/index.json, /Users/redth/nuget/.\n';
            const error = new Error(errorMessage);
            error.stdout = '';
            error.stderr = errorMessage;
            mockExec.mockImplementation((cmd, callback) => {
                expect(cmd).toBe(`dotnet tool install --tool-path "${mockTempPath}" invalid-tool`);
                callback(error, { stdout: '', stderr: errorMessage });
                expect(mockConsoleLog).toHaveBeenCalledWith('📦 Installing invalid-tool...');
                expect(mockConsoleError).toHaveBeenCalledWith('❌ Failed to install tool:', errorMessage);
                expect(mockProcessExit).toHaveBeenCalledWith(1);
            });

            const { installDotnetTool } = await import('../bin/index.js');
            await installDotnetTool('invalid-tool', mockTempPath);
        });

        test('should handle installation failures with specific version', async () => {
            const errorMessage = 'Command failed: dotnet tool install --tool-path "/tmp/mock-path" invalid-tool --version 1.2.3\nVersion 1.2.3 of invalid-tool is not found in NuGet feeds https://api.nuget.org/v3/index.json, https://pkgs.dev.azure.com/xamarin/public/_packaging/maui-nightly/nuget/v3/index.json, /Users/redth/nuget/.\n';
            const error = new Error(errorMessage);
            error.stdout = '';
            error.stderr = errorMessage;
            mockExec.mockImplementation((cmd, callback) => {
                expect(cmd).toBe(`dotnet tool install --tool-path "${mockTempPath}" invalid-tool --version 1.2.3`);
                callback(error, { stdout: '', stderr: errorMessage });
                expect(mockConsoleLog).toHaveBeenCalledWith('📦 Installing invalid-tool (version 1.2.3)...');
                expect(mockConsoleError).toHaveBeenCalledWith('❌ Failed to install tool:', errorMessage);
                expect(mockProcessExit).toHaveBeenCalledWith(1);
            });

            const { installDotnetTool } = await import('../bin/index.js');
            await installDotnetTool('invalid-tool@1.2.3', mockTempPath);
        });
    });

    describe('runDotnetTool', () => {
        test('should execute the tool with correct arguments', async () => {
            const toolName = 'test-tool';
            const toolPath = mockTempPath;
            const args = ['--arg1', '--arg2'];
            const expectedPath = path.join(toolPath, process.platform === 'win32' ? `${toolName}.exe` : toolName);

            mockExec.mockImplementation((cmd, opts, callback) => {
                if (typeof opts === 'function') {
                    callback = opts;
                    opts = {};
                }
                expect(cmd).toBe(`"${expectedPath}" ${args.join(' ')}`);
                expect(opts).toEqual({ stdio: 'inherit' });
                callback(null, { stdout: 'Tool output', stderr: '' });
            });

            const { runDotnetTool } = await import('../bin/index.js');
            await runDotnetTool(toolName, toolPath, args);
            expect(mockConsoleLog).toHaveBeenCalledWith('🚀 Running test-tool...');
        });

        test('should handle tool execution errors', async () => {
            const toolName = 'test-tool';
            const toolPath = mockTempPath;
            const args = [];
            const expectedPath = path.join(toolPath, process.platform === 'win32' ? `${toolName}.exe` : toolName);
            const errorMessage = 'Command failed: "/tmp/mock-path/test-tool" \n/bin/sh: /tmp/mock-path/test-tool: No such file or directory\n';
            const error = new Error(errorMessage);
            error.stdout = '';
            error.stderr = '/bin/sh: /tmp/mock-path/test-tool: No such file or directory\n';

            mockExec.mockImplementation((cmd, opts, callback) => {
                if (typeof opts === 'function') {
                    callback = opts;
                    opts = {};
                }
                expect(cmd).toBe(`"${expectedPath}" ${args.join(' ')}`);
                expect(opts).toEqual({ stdio: 'inherit' });
                callback(error, { stdout: error.stdout, stderr: error.stderr });
            });

            const { runDotnetTool } = await import('../bin/index.js');
            await runDotnetTool(toolName, toolPath, args);
            expect(mockConsoleLog).toHaveBeenCalledWith('🚀 Running test-tool...');
            expect(mockConsoleError).toHaveBeenCalledWith(error.stderr);
            expect(mockProcessExit).toHaveBeenCalledWith(1);
        });
    });

    describe('CLI Integration', () => {
        test('should handle the complete flow', async () => {
            let callCount = 0;
            mockExec.mockImplementation((cmd, opts, callback) => {
                if (typeof opts === 'function') {
                    callback = opts;
                    opts = {};
                }
                switch (callCount++) {
                    case 0: // dotnet --version
                        expect(cmd).toBe('dotnet --version');
                        callback(null, { stdout: 'dotnet version x.y.z' });
                        break;
                    case 1: // tool install
                        expect(cmd).toBe(`dotnet tool install --tool-path "${mockTempPath}" test-tool`);
                        callback(null, { stdout: 'Tool installed successfully' });
                        break;
                    case 2: // tool execution
                        const expectedPath = path.join(mockTempPath, process.platform === 'win32' ? 'test-tool.exe' : 'test-tool');
                        expect(cmd).toBe(`"${expectedPath}" --arg1 --arg2`);
                        callback(null, { stdout: 'Tool output' });
                        break;
                    default:
                        callback(null, { stdout: '' });
                }
            });

            const { program } = await import('../bin/index.js');
            process.argv = ['node', 'script.js', 'test-tool', '--arg1', '--arg2'];
            const actionHandler = mockCommand.action.mock.calls[0][0];
            await actionHandler('test-tool', { args: ['--arg1', '--arg2'] });
            expect(mockConsoleLog).toHaveBeenCalledWith('🧹 Cleaning up...');
            expect(mockCleanup).toHaveBeenCalled();
        });

        test('should handle errors in the flow', async () => {
            let callCount = 0;
            const errorMessage = 'Command failed: dotnet tool install --tool-path "/tmp/mock-path" test-tool\ntest-tool is not found in NuGet feeds https://api.nuget.org/v3/index.json, https://pkgs.dev.azure.com/xamarin/public/_packaging/maui-nightly/nuget/v3/index.json, /Users/redth/nuget/.\n';
            const error = new Error(errorMessage);
            mockExec.mockImplementation((cmd, opts, callback) => {
                if (typeof opts === 'function') {
                    callback = opts;
                    opts = {};
                }
                switch (callCount++) {
                    case 0: // dotnet --version
                        expect(cmd).toBe('dotnet --version');
                        callback(null, { stdout: 'dotnet version x.y.z' });
                        break;
                    case 1: // tool install
                        expect(cmd).toBe(`dotnet tool install --tool-path "${mockTempPath}" test-tool`);
                        callback(error, { stdout: '', stderr: errorMessage });
                        break;
                    default:
                        callback(null, { stdout: '' });
                }
            });

            const { program } = await import('../bin/index.js');
            process.argv = ['node', 'script.js', 'test-tool'];
            const actionHandler = mockCommand.action.mock.calls[0][0];
            await actionHandler('test-tool', { args: [] });
            expect(mockConsoleLog).toHaveBeenCalledWith('📦 Installing test-tool...');
            expect(mockConsoleError).toHaveBeenCalledWith('❌ Failed to install tool:', errorMessage);
            expect(mockConsoleLog).toHaveBeenCalledWith('🧹 Cleaning up...');
            expect(mockCleanup).toHaveBeenCalled();
            expect(mockProcessExit).toHaveBeenCalledWith(1);
        });
    });
});