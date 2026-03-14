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
  if (!authenticate(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
    enableJsonResponse: true, // Return JSON instead of SSE for serverless
  });

  await server.connect(transport);

  await transport.handleRequest(req, res);

  // Clean up after request is complete
  res.on('close', () => {
    transport.close();
    server.close();
  });
}
