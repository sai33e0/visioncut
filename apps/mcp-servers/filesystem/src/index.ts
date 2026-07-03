import { McpServer } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";
import {
  existsSync,
  stat as statSync,
  mkdir as mkdirSync,
  rmdir as rmdirSync,
} from "fs";
import {
  stat,
  mkdir,
  rm,
  readdir,
  readFile,
  writeFile,
} from "fs/promises";
import { join, basename, dirname, isAbsolute, resolve } from "path";

const basePath = process.env.FS_BASE_PATH || process.cwd();
const allowedBase = resolve(basePath);
console.log(`[filesystem-mcp] Allowed base path: ${allowedBase}`);

// Helper to join and ensure the path is within the allowed base
function safeJoin(...paths: string[]): string {
  const fullPath = resolve(allowedBase, ...paths);
  if (!fullPath.startsWith(allowedBase)) {
    throw new Error(`Access denied: path '${paths.join('/')}' is outside the allowed directory`);
  }
  return fullPath;
}

// Initialize the MCP server
const server = new McpServer({
  name: "filesystem-mcp",
  version: "1.0.0",
});

// Read file
server.registerTool(
  "read",
  {
    description: "Read the contents of a file",
    inputSchema: z.object({
      path: z.string().describe("Path to the file to read"),
    }),
  },
  async ({ path }: { path: string }) => {
    const fullPath = safeJoin(path);
    const content = await readFile(fullPath, "utf8");
    return {
      content: [
        {
          type: "text",
          text: content,
        },
      ],
    };
  }
);

// Write file
server.registerTool(
  "write",
  {
    description: "Write content to a file",
    inputSchema: z.object({
      path: z.string().describe("Path to the file to write"),
      content: z.string().describe("Content to write to the file"),
    }),
  },
  async ({ path, content }: { path: string; content: string }) => {
    const fullPath = safeJoin(path);
    const dir = dirname(fullPath);
    if (!(await existsSync(dir))) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, content, "utf8");
    return {
      content: [
        {
          type: "text",
          text: `Successfully wrote to ${path}`,
        },
      ],
    };
  }
);

// List directory
server.registerTool(
  "list",
  {
    description: "List contents of a directory",
    inputSchema: z.object({
      path: z.string()
        .optional()
        .describe("Path to the directory to list (defaults to root)"),
    }),
  },
  async ({ path }: { path?: string }) => {
    const dirPath = path ? safeJoin(path) : allowedBase;
    const entries = await readdir(dirPath, { withFileTypes: true });
    const files = [];
    const directories = [];
    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        directories.push({
          name: entry.name,
          type: "directory",
        });
      } else {
        const fileStat = await stat(entryPath);
        files.push({
          name: entry.name,
          type: "file",
          size: fileStat.size,
          modified: fileStat.mtime.toISOString(),
        });
      }
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ files, directories }, null, 2),
        },
      ],
    };
  }
);

// Get file or directory status
server.registerTool(
  "stat",
  {
    description: "Get file or directory status",
    inputSchema: z.object({
      path: z.string().describe("Path to the file or directory to get stats for"),
    }),
  },
  async ({ path }: { path: string }) => {
    const fullPath = safeJoin(path);
    const fileStat = await stat(fullPath);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              size: fileStat.size,
              isDirectory: fileStat.isDirectory(),
              isFile: fileStat.isFile(),
              modified: fileStat.mtime.toISOString(),
              accessed: fileStat.atime.toISOString(),
              created: fileStat.birthtime?.toISOString() ?? "",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Make directory
server.registerTool(
  "mkdir",
  {
    description: "Create a directory",
    inputSchema: z.object({
      path: z.string().describe("Path of the directory to create"),
      recursive: z.boolean()
        .optional()
        .default(false)
        .describe("Create parent directories if needed"),
    }),
  },
  async ({ path, recursive }: { path: string; recursive?: boolean }) => {
    const fullPath = safeJoin(path);
    await mkdir(fullPath, { recursive: !!recursive });
    return {
      content: [
        {
          type: "text",
          text: `Successfully created directory: ${path}`,
        },
      ],
    };
  }
);

// Remove file or directory
server.registerTool(
  "rm",
  {
    description: "Remove a file or directory",
    inputSchema: z.object({
      path: z.string().describe("Path to the file or directory to remove"),
      recursive: z.boolean()
        .optional()
        .default(false)
        .describe("Remove directories and their contents recursively"),
    }),
  },
  async ({ path, recursive }: { path: string; recursive?: boolean }) => {
    const fullPath = safeJoin(path);
    const fileStat = await stat(fullPath);
    if (fileStat.isDirectory()) {
      if (!recursive) {
        throw new Error("Cannot delete a non-empty directory without setting recursive to true");
      }
      await rm(fullPath, { recursive: true, force: true });
    } else {
      await rm(fullPath, { force: true });
    }
    return {
      content: [
        {
          type: "text",
          text: `Successfully removed: ${path}`,
        },
      ],
    };
  }
);

// Ping for health check
server.registerTool(
  "ping",
  {
    description: "Health check endpoint",
    inputSchema: z.object({}),
  },
  async () => {
    return {
      content: [
        {
          type: "text",
          text: "pong",
        },
      ],
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Filesystem MCP server started on stdio");
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.error("Received SIGINT, shutting down...");
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("Received SIGTERM, shutting down...");
  await server.close();
  process.exit(0);
});

main().catch((error) => {
  console.error("Failed to start filesystem MCP server:", error);
  process.exit(1);
});