# One Click Deploy n8n MCP Server

A Model Context Protocol (MCP) server that allows AI agents to interact with n8n workflows through natural language.

## Deployment

### One-Click Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/YOUR_RAILWAY_TEMPLATE_ID_OR_URL_HERE)

**Note:** After clicking the button, Railway will prompt you to configure the necessary environment variables (see below).

### Docker Deployment (Manual / Local Testing)

The `Dockerfile` in this repository is configured to build the `n8n-mcp-server` and run it with Supergateway.

1.  **Build the Docker Image:**
    ```bash
    docker build -t n8n-mcp-server-supergateway .
    ```

2.  **Run the Docker Container:**
    ```bash
    docker run --rm -it -p 8080:8080 \
      -e PORT=8080 \
      -e N8N_API_URL="YOUR_N8N_API_URL" \
      -e N8N_API_KEY="YOUR_N8N_API_KEY" \
      -e N8N_WEBHOOK_USERNAME="your_webhook_user" \
      -e N8N_WEBHOOK_PASSWORD="your_webhook_password" \
      -e DEBUG=true \
      n8n-mcp-server-supergateway
    ```
    Replace placeholder values with your actual n8n credentials. The server will be accessible via SSE on `http://localhost:8080`. Supergateway provides default paths `/sse` for the event stream and `/message` for posting messages.

## Configuration

The server requires the following environment variables. When deploying to Railway using the button, you will be prompted for these. For local Docker runs, pass them using the `-e` flag as shown above.

*   `N8N_API_URL`: Your n8n instance API URL (e.g., `https://n8n.example.com/api/v1`). **Required.**
*   `N8N_API_KEY`: Your n8n API Key. **Required** and treated as a secret.
*   `N8N_WEBHOOK_USERNAME`: A username for basic authentication on n8n webhook nodes (if your workflows use webhook triggers secured with basic auth). Default: `anyname`.
*   `N8N_WEBHOOK_PASSWORD`: A password for basic authentication on n8n webhook nodes. Default: `somepassword`.
*   `DEBUG`: Set to `true` for verbose logging from the n8n-mcp-server and Supergateway, or `false` for production. Default: `false`.
*   `PORT`: The port the application will listen on. Railway sets this automatically. Supergateway uses this variable. The `Dockerfile` default is `8080`.

### Generating an n8n API Key

1.  Open your n8n instance in a browser.
2.  Go to Settings > API (or a similar path depending on your n8n version).
3.  Create a new API key with appropriate permissions.
4.  Copy the key.

## Connecting to the Server (Client Integration)

Once the `n8n-mcp-server` is running (e.g., deployed on Railway or locally in Docker), it exposes an MCP interface over Server-Sent Events (SSE).

The Supergateway instance within the Docker container (as defined in `Dockerfile`) typically makes the MCP server available at:
*   **SSE Stream:** `http://<server_address>:<port>/sse`
*   **Message Endpoint:** `http://<server_address>:<port>/message`

(If deployed on Railway, `<server_address>:<port>` will be your public Railway URL, e.g., `https://my-n8n-mcp.up.railway.app`)

There are a couple of ways AI agents or MCP clients can connect:

1.  **Direct SSE Connection:**
    If your MCP client (e.g., your AI agent's framework) natively supports connecting to an MCP server via an SSE URL and a message endpoint, configure it with the URLs mentioned above.

    **Example `mcp.json` configuration for direct SSE:**
    ```json
    {
      "n8n_local_docker_sse": {
        "url": "https://my-n8n-mcp.up.railway.app/sse",
        "disabled": false,
        "alwaysAllow": [
          "mcp_n8n_docker_direct_list_workflows", 
          "mcp_n8n_docker_direct_get_workflow",
          "mcp_n8n_docker_direct_create_workflow",
          "mcp_n8n_docker_direct_update_workflow",
          "mcp_n8n_docker_direct_delete_workflow",
          "mcp_n8n_docker_direct_activate_workflow",
          "mcp_n8n_docker_direct_deactivate_workflow",
          "mcp_n8n_docker_direct_list_executions"
        ],
        "timeout": 300
      }
    }
    ```
    When you deploy add your variables and make sure to expose the 8080 port in railway.

2.  **Using Supergateway on the Client-Side (SSE-to-stdio bridge):**
    If your MCP client expects to launch a local command that communicates via stdio (standard input/output), you can use *another* Supergateway instance locally on the client's machine to bridge the remote SSE connection back to stdio.

    **Example `mcp.json` or similar client configuration:**
    ```json
    {
      "mcpServers": {
        "n8n-remote-sse": {
          "command": "npx",
          "args": [
            "-y",
            "supergateway",
            "--sse", "http://<server_address>:<port>", // Replace with your actual server URL
            "--outputTransport", "stdio",
            "--logLevel", "info" // Optional: for debugging Supergateway on the client
          ],
          "env": {
             // Any environment variables Supergateway client might need, usually none for this mode
          },
          "disabled": false
        }
      }
    }
    ```
    In this client-side Supergateway setup:
    *   Your AI agent's MCP client runs `npx -y supergateway --sse ...` as its command.
    *   This local Supergateway connects to your remote `n8n-mcp-server`'s SSE endpoint.
    *   It then presents an MCP interface over stdio to your AI agent.

## Available Tools

The server provides the following tools (accessed via the MCP connection established above):

### Using Webhooks

This MCP server supports executing workflows through n8n webhooks. To use this functionality:

1.  Create a webhook-triggered workflow in n8n.
2.  Set up Basic Authentication on your webhook node (optional, but recommended).
3.  Use the `run_webhook` tool to trigger the workflow, passing just the workflow name.

Example (conceptual client-side code):
```javascript
// Assuming 'mcp.tools.run_webhook' is available on your connected MCP client instance
const result = await mcp.tools.run_webhook({
  workflowName: "hello-world", // Will call <n8n-url>/webhook/hello-world
  data: {
    prompt: "Hello from AI assistant!"
  }
});
```
Webhook authentication (if used) is handled using the `N8N_WEBHOOK_USERNAME` and `N8N_WEBHOOK_PASSWORD` environment variables configured for the server.

### Workflow Management

- `workflow_list`: List all workflows
- `workflow_get`: Get details of a specific workflow
- `workflow_create`: Create a new workflow
- `workflow_update`: Update an existing workflow
- `workflow_delete`: Delete a workflow
- `workflow_activate`: Activate a workflow
- `workflow_deactivate`: Deactivate a workflow

### Execution Management

- `execution_run`: Execute a workflow via the API
// Note: run_webhook is already listed above, often preferred for triggering.
- `execution_get`: Get details of a specific execution
- `execution_list`: List executions for a workflow
// `execution_stop` might not be implemented in all n8n versions or the base server.

## Self-Hosting (Advanced)

For users who prefer to run the server outside of Docker or a platform like Railway, you can run the Node.js application directly. This gives you more control but requires manual setup of the execution environment and potentially Supergateway if SSE is desired.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/YOUR_USERNAME/YOUR_REPONAME.git # Replace with your repository URL
    cd YOUR_REPONAME
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Build the Server:**
    ```bash
    npm run build
    ```
    This compiles the TypeScript to JavaScript in the `build` directory.

4.  **Configure Environment Variables:**
    Create a `.env` file in the project root (you can copy `.env.example`) and fill in your n8n API details (`N8N_API_URL`, `N8N_API_KEY`, etc.) and any other required variables like `PORT` (if not 8080) or `DEBUG`.

5.  **Run the stdio MCP Server:**
    ```bash
    node build/index.js
    ```
    This will start the `n8n-mcp-server` communicating over standard input/output (stdio).

6.  **Exposing via SSE (Optional, Manual Supergateway Setup):
    If you need to access this self-hosted server via SSE, you will need to run your own instance of Supergateway to wrap the stdio command above. For example:
    ```bash
    npx -y supergateway --stdio "node build/index.js" --port 8080 # Add other Supergateway flags as needed
    ```
    Ensure that the environment variables configured in step 4 are accessible to the `node build/index.js` process when launched by Supergateway.

This method is more involved than the Docker or Railway deployments, which handle the Supergateway integration automatically within the container.

## Credits 

Based on this repo: https://github.com/leonardsellem/n8n-mcp-server/

## License

MIT
