# Guide: Interacting with the n8n-mcp-server Effectively

This guide provides best practices and key learnings for an AI agent (or developer) interacting with the `n8n-mcp-server` to manage n8n workflows programmatically. Understanding these points will lead to more reliable and successful operations.

## Core Principle: JSON-RPC Communication via Stdio

The `n8n-mcp-server` communicates with its client (e.g., Cursor, an MCP-enabled application) using JSON-RPC messages exchanged over standard input (`stdin`) and standard output (`stdout`).
*   The client sends JSON-RPC requests to the server's `stdin`.
*   The server sends JSON-RPC responses (or errors) to its `stdout`.

**Key Learning:** Any non-JSON-RPC output from the server to `stdout` can break the communication protocol, leading to "Unexpected token" errors or other parsing failures on the client side.

## 1. Logging: The Double-Edged Sword

Logging is crucial for debugging, but it was the primary source of instability in early interactions.

*   **Problem:** `console.error()` or `console.log()` statements writing directly to `stderr` (or worse, `stdout`) during server operation, especially during startup or request processing, can interfere with the MCP client's ability to parse JSON-RPC responses from `stdout`. Even if `stderr` is technically a separate stream, the MCP client framework might be sensitive to its output, especially if it's not expecting it or if it's voluminous.
*   **Best Practices:**
    *   **`stdout` is Sacred for JSON-RPC:** Once the server is in its main operational loop, `stdout` should *only* be used for valid JSON-RPC messages.
    *   **`stderr` for Controlled Debugging:**
        *   Use `stderr` for logging (e.g., via `console.error` or a logging library).
        *   Keep startup logging to a minimum or ensure it's clearly distinguishable and doesn't interfere with initial handshake messages.
        *   Make extensive debug logging conditional (e.g., behind a `DEBUG=true` environment variable). The Axios interceptor logs in `N8nApiClient` are a good example of this.
    *   **Logging Libraries:** For robust logging, use a library (e.g., `winston`, `pino` for Node.js) that can be configured for different log levels, outputs (file, `stderr`), and formats. This helps manage log verbosity and destination.
    *   **Focus Logs:** When debugging a specific tool (like `update_workflow`), enable detailed logging *only* for that tool's handler and the relevant API client methods, rather than globally.

## 2. Docker Build and Deployment

Ensuring the correct version of the `n8n-mcp-server` code is running in the Docker container is fundamental.

*   **Problem:** Initially, our `Dockerfile` used `npm install -g n8n-mcp-server`, which always pulled the latest *published* version from npm, ignoring local source code changes.
*   **Best Practice:**
    *   Use a `Dockerfile` that builds from your local source code. A multi-stage Dockerfile is recommended:
        1.  A `builder` stage installs all dependencies (including devDependencies), copies source code, and runs the build process (e.g., `npm run build` for TypeScript).
        2.  A final, lean production stage copies only the built application (e.g., the `build` directory) and production dependencies from the `builder` stage.
    *   Always rebuild the Docker image (`docker build -t your-image-name .`) after making code changes.
    *   Ensure your `mcp.json` configuration points to the correct Docker image name you've built.

## 3. n8n Workflow Updates (`update_workflow` tool)

Updating n8n workflows, especially with complex nodes, requires precision.

*   **Payload is Key:** The n8n API (e.g., `PUT /workflows/{id}`) is strict about the payload. Sending extraneous properties will result in "request/body must NOT have additional properties" errors.
    *   The minimal required payload for an update that preserves structure but changes name is: `name`, `nodes`, `connections`, and `settings: {}`.
    *   `staticData` should generally be omitted unless specifically needed and understood.
    *   Fields like `active`, `tags`, `createdAt`, `id` (in body), `versionId` should NOT be in the PUT request body for general updates.
*   **Node-Specific Parameters:**
    *   **Simple Nodes:** Parameters are often directly in the `parameters` object of the node definition.
    *   **Complex/Newer Nodes (e.g., `@n8n/n8n-nodes-langchain.agent`):
        *   The exact `type` string (including any scope like `@n8n/`) is critical.
        *   The `typeVersion` can also be important.
        *   Core configuration (like model, task, credentials for an AI Agent) may *not* be simple top-level properties in the `parameters` object. They might be nested, managed via sub-node connections (e.g., an LLM node connected to an Agent node), or set through an `options` object that has a specific internal structure.
    *   **Ground Truth for Node Structure:**
        1.  Manually configure the desired node and workflow in the n8n UI.
        2.  Export the workflow (or copy the node's JSON).
        3.  Inspect this JSON to understand the exact structure, parameter names, types, and versions required for programmatic creation/update. This is the most reliable way to determine the correct payload.
*   **Node IDs:**
    *   When updating existing nodes, include their `id`.
    *   When adding new nodes, omit the `id` (n8n will generate it).
*   **Connections:** The `connections` object uses node *names* as keys. Ensure these match the `name` properties in your `nodes` array.

## 4. General Tool Interaction

*   **Fetch Before Modify:** When updating a resource (like a workflow), it's often a good pattern to first fetch its current state (`get_workflow`) to have the latest `nodes` and `connections` if you only intend to make partial modifications (like changing a name or a single node's parameters).
*   **Idempotency:** Design tool calls to be idempotent where possible, though this can be challenging with create/update operations.
*   **Error Handling:** The `n8n-mcp-server` should provide clear error messages. The MCP client will wrap these in its own error structure. Understand both layers for effective debugging.

## 5. Iterative Testing

*   **Isolate Changes:** When debugging, change one thing at a time.
*   **Minimal Test Cases:** Start with the simplest possible operation (e.g., updating only a workflow name) to establish a baseline.
*   **Direct API Testing (If Stuck):** If MCP tool calls consistently fail and the server-side code seems correct, using a direct API client (like `curl`, Postman, or a simple script like our `test_n8n_update.mjs`) can help determine if the issue is with the n8n API itself, the payload, or the MCP server/client interaction.

## 6. Interacting with an SSE-Wrapped MCP Server (via Supergateway)

When the `n8n-mcp-server` is deployed with Supergateway to expose its functionality over SSE (Server-Sent Events):

*   **Server-Side:** The `n8n-mcp-server` itself still operates on stdio. Supergateway, running in the same container, manages the `n8n-mcp-server` as a child process and translates its stdio communication to/from SSE on a specified HTTP port.
*   **Client-Side Connection:**
    *   **Using Supergateway (SSE-to-stdio bridge):** Most existing MCP clients (like Cursor) that expect a command-based stdio server will need to use Supergateway *locally* in its SSE-to-stdio mode. The `mcp.json` (or equivalent client configuration) will specify a command like `npx supergateway --sse https://<your-deployed-server-url>/sse`. This local Supergateway instance connects to the remote SSE feed and provides a stdio interface for the MCP client.
    *   **Native SSE MCP Client:** If an MCP client has native support for connecting to MCP servers over SSE, it could directly consume the SSE feed from the deployed URL. This bypasses the need for a local Supergateway bridge.
*   **Debugging:** Debugging involves checking logs at multiple points:
    1.  The client application (e.g., Cursor's MCP inspector).
    2.  The local Supergateway bridge (if used).
    3.  The deployed Supergateway logs on the server (e.g., via Railway logs).
    4.  The `n8n-mcp-server` logs (which are part of the deployed Supergateway's output).

By following these guidelines, interactions with the `n8n-mcp-server` should be much smoother and easier to debug. 