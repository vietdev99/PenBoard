#!/usr/bin/env node

import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import pkg from '../../package.json'
import { TOOL_DEFINITIONS, handleToolCall } from './tool-registry'
import { MCP_DEFAULT_PORT } from '@/constants/app'

// --- Tool registration ---

/** Register tool handlers on a Server instance. */
function registerTools(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    try {
      const text = await handleToolCall(name, args)
      return { content: [{ type: 'text', text }] }
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      }
    }
  })
}

// --- HTTP server helper ---

function startHttpServer(port: number): void {
  // Per-session transport map: each client gets its own Server + Transport
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>()

  const httpServer = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id')
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.url !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found. Use /mcp endpoint.' }))
      return
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined

    // Route to existing session
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!
      if (req.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const body = JSON.parse(Buffer.concat(chunks).toString())
        await session.transport.handleRequest(req, res, body)
      } else {
        await session.transport.handleRequest(req, res)
      }
      return
    }

    // New session — only POST (initialize) is valid without session ID
    if (req.method === 'POST') {
      const mcpServer = new Server(
        { name: pkg.name, version: pkg.version },
        { capabilities: { tools: {} } },
      )
      registerTools(mcpServer)

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          sessions.set(sid, { transport, server: mcpServer })
        },
        onsessionclosed: (sid: string) => {
          sessions.delete(sid)
        },
      })

      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId)
      }

      await mcpServer.connect(transport)

      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      const body = JSON.parse(Buffer.concat(chunks).toString())
      await transport.handleRequest(req, res, body)
      return
    }

    // Invalid: GET/DELETE without valid session ID
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Invalid or missing session ID' }, id: null }))
  })

  httpServer.listen(port, '0.0.0.0', () => {
    console.error(`PenBoard MCP server listening on http://0.0.0.0:${port}/mcp`)
  })
}

// --- Start ---

function parseArgs(): { stdio: boolean; http: boolean; port: number } {
  const args = process.argv.slice(2)
  const hasHttp = args.includes('--http')
  const hasStdio = args.includes('--stdio')
  const portIdx = args.indexOf('--port')
  const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : MCP_DEFAULT_PORT

  if (hasHttp && hasStdio) return { stdio: true, http: true, port: isNaN(port) ? MCP_DEFAULT_PORT : port }
  if (hasHttp) return { stdio: false, http: true, port: isNaN(port) ? MCP_DEFAULT_PORT : port }
  return { stdio: true, http: false, port: MCP_DEFAULT_PORT }
}

async function main() {
  const { stdio, http, port } = parseArgs()

  if (stdio && http) {
    // Both: stdio server + HTTP server (per-session)
    const stdioServer = new Server(
      { name: pkg.name, version: pkg.version },
      { capabilities: { tools: {} } },
    )
    registerTools(stdioServer)
    await stdioServer.connect(new StdioServerTransport())

    startHttpServer(port)
  } else if (http) {
    startHttpServer(port)
  } else {
    const server = new Server(
      { name: pkg.name, version: pkg.version },
      { capabilities: { tools: {} } },
    )
    registerTools(server)
    await server.connect(new StdioServerTransport())
  }
}

// Prevent uncaught errors from crashing the MCP server process
process.on('uncaughtException', (err) => {
  console.error('MCP server uncaught exception:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('MCP server unhandled rejection:', err)
})

main().catch((err) => {
  console.error('MCP server failed to start:', err)
  process.exit(1)
})
