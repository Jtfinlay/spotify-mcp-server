import type { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { albumTools } from '../src/albums.js';
import { playTools } from '../src/play.js';
import { playlistTools } from '../src/playlist.js';
import { readTools } from '../src/read.js';

function createServer(): McpServer {
  const server = new McpServer({
    name: 'spotify-controller',
    version: '1.0.0',
  });

  for (const tool of [
    ...readTools,
    ...playTools,
    ...albumTools,
    ...playlistTools,
  ]) {
    server.tool(tool.name, tool.description, tool.schema, tool.handler);
  }

  return server;
}

function authenticate(req: IncomingMessage): boolean {
  const expectedToken = process.env.MCP_AUTH_TOKEN;
  if (!expectedToken) {
    // If no token configured, allow all requests (dev mode)
    return true;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  return authHeader.slice(7) === expectedToken;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[${requestId}] ${req.method} ${req.url} - request received`);

  if (!authenticate(req)) {
    console.log(`[${requestId}] authentication failed`);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  console.log(`[${requestId}] authenticated`);

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
    enableJsonResponse: true, // Return JSON instead of SSE for serverless
  });

  // Register cleanup before handleRequest so it fires even if handleRequest hangs
  res.on('close', () => {
    console.log(`[${requestId}] response closed, cleaning up`);
    transport.close();
    server.close();
  });

  try {
    console.log(`[${requestId}] connecting server to transport`);
    await server.connect(transport);
    console.log(`[${requestId}] connected, handling request`);

    await transport.handleRequest(req, res);
    console.log(`[${requestId}] request handled successfully`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(`[${requestId}] error handling request: ${message}`, stack);

    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', details: message }));
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}
