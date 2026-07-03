import { createStdioServer } from '@modelcontextprotocol/server-filesystem';
import path from 'path';

const base = process.env.FS_BASE_PATH || process.cwd();
console.log(`[filesystem-mcp] Base path: ${base}`);

// Create a server that allows read/write within base
const server = createStdioServer({
  basePath: path.resolve(base),
});

server.start();
