# n8n MCP Server: A Best-Practice Implementation

This repository provides a robust, production-ready Model Context Protocol (MCP) server for interacting with [n8n](https://n8n.io/), an extendable workflow automation tool.

Beyond its specific function, this project is designed to be a **comprehensive, best-practice template** for building any MCP server. It demonstrates a clean architecture, separation of concerns, and a clear development pattern that you can adapt to create MCP servers for any API or service.

## What is the Model Context Protocol (MCP)?

At its core, the **Model Context Protocol (MCP)** is an open standard designed to standardize how AI models (like LLMs) communicate with external applications, tools, and data sources.

Before MCP, connecting an AI to a new tool (e.g., a database, an API) required custom, one-off integrations. MCP creates a "plug-and-play" framework. Any AI that "speaks" MCP can instantly connect to and use any tool that also exposes an MCP interface, without needing bespoke code for that specific tool.

This project is an **MCP Server**. It acts as a bridge, translating the standard MCP language into specific calls for the n8n API.

## Core Architectural Concepts

This repository follows a clean, layered architecture that separates concerns, making it easy to understand, maintain, and extend.

### Directory Structure

The `src` directory is organized into logical modules:

- `src/api`: Handles all communication with the external (n8n) API.
- `src/config`: Manages environment variables and server setup.
- `src/errors`: Defines custom error types and handling.
- `src/resources`: Handles MCP resource-related requests (e.g., listing available workflows as resources).
- `src/tools`: Contains the core logic for each tool the MCP server exposes.
- `src/types`: Defines TypeScript types and interfaces used throughout the application.
- `src/utils`: Contains helper functions and formatters.
- `src/index.ts`: The main application entry point.

### The Request Lifecycle

A typical `CallTool` request from an AI agent flows through the server like this:

1.  **Entrypoint (`index.ts`)**: The server receives the request via the `StdioServerTransport`.
2.  **Server Config (`config/server.ts`)**: The main request handler determines which tool was called (e.g., `list_workflows`).
3.  **Tool Handler (`tools/workflow/list.ts`)**: The specific handler for `list_workflows` is executed.
4.  **API Service (`api/n8n-client.ts`)**: The handler calls the high-level API service to fetch the required data.
5.  **API Client (`api/client.ts`)**: The service uses the low-level `axios` client to make the actual HTTP request to the n8n API.
6.  **Response**: The data flows back through the layers, is formatted into the standard MCP response format, and is sent back to the agent.

## Deep Dive: How It Works

This section breaks down the key components of the architecture.

### 1. Configuration (`src/config`)

- **`environment.ts`**: This file is responsible for loading and validating all necessary environment variables (e.g., `N8N_API_URL`, `N8N_API_KEY`). It uses `dotenv` to load a `.env` file for local development and throws clear, specific errors if required variables are missing. This is the central place to define any configuration your server needs.
- **`server.ts`**: This is the heart of the server setup. The `configureServer` function initializes the MCP `Server` instance. Crucially, it sets up the request handlers, which act as a router for incoming MCP requests. The `CallToolRequestSchema` handler contains the main `if/else if` block that maps a tool name string to its corresponding handler class from the `src/tools` directory.

### 2. The API Layer (`src/api`)

This module uses a two-layer approach for clean and maintainable API interactions.

- **`client.ts` (`N8nApiClient`)**: This is the **low-level client**. It uses `axios` to make the actual HTTP requests. Its responsibilities include setting the base URL, adding authentication headers (`X-N8N-API-KEY`), handling request/response logging (if `DEBUG` is true), and wrapping responses in consistent error handling.
- **`n8n-client.ts` (`N8nApiService`)**: This is the **high-level service layer** or "facade." It provides a clean, user-friendly interface for the rest of the application (specifically the tool handlers). It hides the underlying `axios` implementation and exposes simple methods like `getWorkflows()` or `updateWorkflow(id, data)`. This separation means if you ever wanted to swap `axios` for another HTTP library, you would only need to change `client.ts`, not the dozens of places it's used.

### 3. Tool Implementation (`src/tools`)

Each tool is implemented as a class that extends a `BaseToolHandler`. Let's look at `tools/workflow/list.ts` as an example:

- **Handler Class (`ListWorkflowsHandler`)**: This class extends `BaseWorkflowToolHandler` and has one primary job: to implement the `execute` method.
- **`execute()` Method**: This method contains the logic for the tool. It calls the `apiService` to fetch data, formats the data into a user-friendly format, and returns a `ToolCallResult`.
- **Tool Definition (`getListWorkflowsToolDefinition()`)**: Each tool has a corresponding function that returns its `ToolDefinition`. This object tells the AI agent everything it needs to know to use the tool: its `name`, `description`, and an `inputSchema` defining the parameters it accepts. This schema is crucial for the AI to correctly formulate its requests.

### 4. The Entrypoint (`src/index.ts`)

This file is simple but vital. It performs the following steps:

1.  Calls `loadEnvironmentVariables()` to bootstrap the configuration.
2.  Calls `configureServer()` to create and set up the server instance.
3.  Creates a **`StdioServerTransport`**. This tells the server to communicate over standard input and standard output (stdio). This is a common pattern for MCP servers, as it creates a simple, self-contained process.
4.  Connects the server to the transport and logs that it's running.

### 5. Deployment and Exposure (`Dockerfile` & Supergateway)

The core server communicates over `stdio`, but network clients can't connect to that directly. The `Dockerfile` solves this using **`supergateway`**.

The `CMD` instruction in the Dockerfile is:
`npx -y supergateway --stdio "node build/index.js" --port ${PORT:-8000}`

This command does two things:

1.  It runs our application: `node build/index.js`.
2.  It pipes the `stdio` of our application to `supergateway`. `supergateway` then exposes this `stdio` interface as a web server on the specified port, providing the `/sse` (Server-Sent Events) and `/message` endpoints that remote MCP clients can connect to.

This `stdio -> supergateway -> SSE` pattern is a powerful and standard way to deploy MCP servers.

## How to Deploy and Use This Server

You can deploy and connect to this server in minutes.

### One-Click Deploy to Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/se2WHK?referralCode=SQ5fZY)

Click the button to deploy to Railway. You will be prompted to enter the necessary environment variables.

### Manual Docker Deployment

1.  **Build the Docker Image:**

    ```bash
    docker build -t n8n-mcp-server .
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
      n8n-mcp-server
    ```
    The server will be accessible via SSE at `http://localhost:8080/sse`.

### Configuration

The server requires the following environment variables:

- `N8N_API_URL`: Your n8n instance API URL (e.g., `https://n8n.example.com/api/v1`). **Required.**
- `N8N_API_KEY`: Your n8n API Key. **Required.**
- `N8N_WEBHOOK_USERNAME`: A username for basic authentication on n8n webhook nodes.
- `N8N_WEBHOOK_PASSWORD`: A password for basic authentication on n8n webhook nodes.
- `DEBUG`: Set to `true` for verbose logging. Default: `false`.
- `PORT`: The port the application will listen on. Default: `8080`.

## Building Your Own MCP Server (Tutorial)

Use this repository as a template to create an MCP server for any API.

1.  **Fork/Clone this Repository**
    Start by creating a copy of this project to serve as the foundation for your new server.

2.  **Define Environment Variables**
    Go to `src/config/environment.ts`. Modify the `ENV_VARS` object and the `getEnvConfig` function to load and validate the specific environment variables your new API requires.

3.  **Implement Your API Client**

    - In `src/api/client.ts`, update `N8nApiClient` (rename it to something suitable) to connect to your target API. Change the `baseURL`, authentication headers, and method endpoints.
    - In `src/api/n8n-client.ts`, update the `N8nApiService` facade to provide high-level methods that match your API's capabilities (e.g., `getUsers()`, `createPost(data)`).

4.  **Create Tool Handlers**

    - In `src/tools`, create new directories for your tool categories (e.g., `user`, `post`).
    - For each tool you want to expose, create a new handler file (e.g., `tools/user/list.ts`).
    - Implement the handler class, the `execute` method (which should call your new API service), and the tool definition function.

5.  **Register Your Tools**
    In `src/config/server.ts`, update the `setRequestHandler` for `CallToolRequestSchema`. Change the `if/else if` block to import and route to your new tool handlers based on the incoming tool name. Also update `setupToolListRequestHandler` to return your new tool definitions.

6.  **Update Metadata**
    Change the server name in `src/config/server.ts` and update `package.json` with your project's details.

7.  **Build and Run**
    You can now build and run your new server. The Docker and deployment configurations will work out-of-the-box for your new server.

## Available n8n Tools

This server provides the following tools for interacting with n8n:

### Workflow Management

- `list_workflows`: List all workflows.
- `get_workflow`: Get details of a specific workflow.
- `create_workflow`: Create a new workflow.
- `update_workflow`: Update an existing workflow.
- `delete_workflow`: Delete a workflow.
- `activate_workflow`: Activate a workflow.
- `deactivate_workflow`: Deactivate a workflow.

### Execution Management

- `run_webhook`: Execute a workflow via its webhook trigger.
- `list_executions`: List executions for a workflow.
  -- `get_execution`: Get details of a specific execution.
- `delete_execution`: Delete a specific execution.

## Credits

This project is based on the original `n8n-mcp-server` by [leonardsellem](https://github.com/leonardsellem/n8n-mcp-server/). This version has been refactored and documented to serve as a comprehensive template.

## License

MIT
