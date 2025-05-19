# Implementation Plan: Deploying n8n-mcp-server and Iterating on Intelligent Agent

## 1. Project Context and Goals

*   **What We've Worked On:** We've successfully set up, debugged, and stabilized a local `n8n-mcp-server` instance. This involved:
    *   Correcting Docker build processes to use local source code.
    *   Identifying and resolving `stderr` logging interference with MCP client JSON-RPC communication.
    *   Refining the `update_workflow` tool handler to correctly interact with the n8n API.
    *   Understanding the JSON structure for complex n8n nodes like the AI Agent and its dependencies.
*   **Why:** The primary goal was to enable reliable programmatic creation and management of n8n workflows via an MCP server, laying the groundwork for more advanced AI-driven automation of workflow generation. A key objective is to make this server accessible remotely via SSE.
*   **Current Status:**
    *   The `n8n-mcp-server` (from local source) is functional for core workflow operations (create, get, update, list, delete, activate, deactivate).
    *   We have documented the setup, learnings, and troubleshooting in `N8N_MCP_SERVER_SETUP_AND_STATUS.md` and `MCP_SERVER_INTERACTION_GUIDE.md`.
    *   We have a specification for an "Intelligent n8n Workflow Builder Agent" in `INTELLIGENT_N8N_WORKFLOW_BUILDER_AGENT_SPEC.md`.
    *   The `Dockerfile` for `n8n-mcp-server` has been updated and validated to run the server via `Supergateway`, which will expose its stdio communication over SSE. This includes fixes for `EXPOSE` and `npm ci --ignore-scripts` issues.
    *   Local testing of the Dockerized `n8n-mcp-server` with Supergateway has been successful: the server runs, `/healthz` endpoint works, and Cursor can connect to the local SSE endpoint (`http://localhost:8000/sse`) directly and list workflows.
*   **User's Overall Goals:**
    1.  To have a robust, one-click deployable `n8n-mcp-server` on Railway, accessible via SSE using Supergateway.
    2.  To iterate on and develop the "Intelligent n8n Workflow Builder Agent" which can connect to this deployed server.
    3.  To ensure clients (like Cursor or the agent) can easily connect to the SSE-enabled server.

## 2. Implementation Plan: Next Steps

This plan focuses on deploying the Supergateway-enabled `n8n-mcp-server` to Railway and then preparing for the development and iteration of the intelligent agent.

### Phase 1: Prepare `n8n-mcp-server` for Production Deployment (Supergateway Integration)

*   **Step 1.1: Initialize a Git Repository for `n8n-mcp-server`**
    *   **Action:** If not already done, navigate to your `n8n-mcp-server` project directory and initialize a Git repository.
        ```bash
        cd path/to/n8n-mcp-server
        git init
        git add .
        git commit -m "Initial commit of n8n-mcp-server with Supergateway integration in Dockerfile"
        ```
    *   **Rationale:** Version control is essential for managing code, tracking changes, and deploying to platforms like Railway.

*   **Step 1.2: Verify Dockerfile with Supergateway Integration**
    *   **Action:** Confirm the `n8n-mcp-server/Dockerfile` uses Supergateway in its `CMD` to wrap the `node build/index.js` command and expose it.
        ```dockerfile
        # Stage 1: Build the application
        FROM node:18-slim AS builder
        WORKDIR /app
        COPY package.json package-lock.json ./
        RUN npm ci
        COPY . .
        RUN npm run build

        # Stage 2: Create the production image
        FROM node:18-slim
        WORKDIR /app
        ENV NODE_ENV production
        COPY --from=builder /app/package.json /app/package-lock.json ./
        RUN npm ci --omit=dev --ignore-scripts
        COPY --from=builder /app/build ./build
        # COPY --from=builder /app/node_modules ./node_modules # Usually not needed if prod dependencies are reinstalled

        EXPOSE ${PORT:-8000} # Document the port Supergateway will listen on

        # Command to run Supergateway, which in turn runs the n8n-mcp-server via stdio.
        # Railway will set the PORT environment variable. Supergateway uses this PORT.
        # node build/index.js will inherit environment variables like N8N_API_URL, N8N_API_KEY, DEBUG.
        CMD ["sh", "-c", "npx -y supergateway --stdio \\\"node build/index.js\\\" --port ${PORT:-8000} --healthEndpoint /healthz --cors --logLevel info"]
        ```
    *   **Rationale:** This Dockerfile is the core of the SSE-enabled deployment. The `CMD` ensures Supergateway is the primary process, managing the `n8n-mcp-server` and providing the SSE interface.

*   **Step 1.3: Create `railway.json` or Configure Railway via UI for Deployment**
    *   **Action:** Prepare for Railway deployment.
        *   **Option A (Using `railway.json` - Recommended for IaC):**
            Create a `railway.json` file in the root of your `n8n-mcp-server` repository.
            ```json
            {
              "$schema": "https://railway.app/railway.schema.json",
              "build": {
                "builder": "DOCKERFILE",
                "dockerfilePath": "Dockerfile"
              },
              "deploy": {
                // startCommand is now handled by Dockerfile CMD
                "healthcheckPath": "/healthz", // Supergateway provides this
                "healthcheckTimeout": 100,
                "restartPolicyType": "ON_FAILURE",
                "restartPolicyMaxRetries": 10
              }
            }
            ```
            *   **Note on Health Check:** Supergateway's `--healthEndpoint /healthz` argument in the Docker `CMD` makes this path available. Railway will use it to check service health. The port will be automatically detected by Railway (usually from the `$PORT` env var it injects).
        *   **Option B (Railway UI Configuration):**
            Configure build (Dockerfile) and deploy settings (health check `/healthz`) directly in the Railway UI.
    *   **Rationale:** Define how Railway should build and run your application, ensuring it correctly identifies the health check endpoint provided by Supergateway.

### Phase 2: Deploy SSE-enabled `n8n-mcp-server` to Railway

*   **Step 2.1: Push Repository to GitHub/GitLab**
    *   **Action:** Create/use a private repository on GitHub (or your preferred Git provider) and push your `n8n-mcp-server` code with the updated Dockerfile and `railway.json`.
    *   **Rationale:** Railway typically deploys from a Git repository.

*   **Step 2.2: Create a New Project in Railway and Connect Repository**
    *   **Action:**
        1.  Log in to Railway.
        2.  Create a new project.
        3.  Connect it to the Git repository.
        4.  Railway should detect your `Dockerfile` (and `railway.json` if present).
    *   **Rationale:** Set up the deployment pipeline.

*   **Step 2.3: Configure Environment Variables in Railway**
    *   **Action:** In the Railway project settings for your `n8n-mcp-server` service, configure:
        *   `N8N_API_URL`
        *   `N8N_API_KEY`
        *   `N8N_WEBHOOK_USERNAME` (if used)
        *   `N8N_WEBHOOK_PASSWORD` (if used)
        *   `DEBUG` (e.g., `true` for verbose Supergateway and n8n-mcp-server logs, `false` for production)
        *   `BASE_URL` (Optional, if Supergateway needs to construct absolute URLs for clients, Railway provides `RAILWAY_PUBLIC_DOMAIN` which can be used)
        *   Supergateway specific ENVs if needed (e.g., for fine-grained CORS: `SG_CORS_ORIGINS="http://localhost:3000,https://my-app.com"`)
    *   **Rationale:** Provide the runtime configuration for Supergateway and the underlying `n8n-mcp-server`. Railway will also inject a `PORT` variable that Supergateway will use.

*   **Step 2.4: Trigger Deployment and Monitor Logs**
    *   **Action:** Railway will typically auto-deploy. Monitor the build and deployment logs in the Railway dashboard. Specifically look for Supergateway startup messages and any errors.
    *   **Testing:**
        *   Once deployed, access `https://<your-railway-app-url>/healthz`. It should return `ok`.
        *   Note the SSE endpoint (e.g., `https://<your-railway-app-url>/sse` if default path is used).
    *   **Rationale:** Verify the deployment is successful, Supergateway is running, and the `n8n-mcp-server` starts correctly under Supergateway.

*   **Step 2.5: Update MCP Client Configuration (e.g., Cursor's `mcp.json`, Agent's config)**
    *   **Problem:** Local MCP clients (like Cursor) or the Intelligent Agent need to connect to the deployed SSE endpoint. They cannot directly use `docker run ...` for a remote SSE service.
    *   **Solution with Supergateway (SSE -> stdio mode):**
        Clients will use Supergateway *locally* to convert the remote SSE stream back into stdio.
        *   Modify the `mcp.json` entry for `n8n_docker_direct` (or create a new one for the remote server, e.g., `n8n_railway_sse`):
            ```json
            // In mcp.json (e.g., for Cursor or the agent's MCP client)
            "n8n_railway_sse": {
              "command": "npx", // Or direct path to supergateway if installed globally/locally
              "args": [
                "-y",
                "supergateway",
                "--sse", "https://<YOUR_RAILWAY_APP_URL>/sse", // Replace with your actual Railway SSE URL
                "--logLevel", "info" // Or "debug" for troubleshooting client-side Supergateway
                // Add --header or --oauth2Bearer if your Railway Supergateway requires auth
              ],
              "disabled": false,
              "alwaysAllow": [ // List the n8n tools
                "mcp_n8n_docker_direct_list_workflows", "mcp_n8n_docker_direct_get_workflow", // etc.
              ],
              "timeout": 300
            }
            ```
        *   This command tells the local Supergateway to connect to the remote SSE endpoint and expose it as a local stdio MCP server, which the MCP client (Cursor, agent) can then use.
    *   **Rationale:** Enable local MCP tools to communicate with the remote, SSE-enabled `n8n-mcp-server`.

### Phase 3: Iterate on the "Intelligent n8n Workflow Builder Agent"

*   **Step 3.1: Choose Agent Development Environment/Framework**
    *   **Action:** Decide where and how you will run/develop the "Intelligent n8n Workflow Builder Agent". This might be within Cursor itself (if its AI capabilities allow for such complex prompting and tool use directly) or a separate Python/Node.js LangChain/LlamaIndex project.
    *   **Rationale:** Set up the environment where the agent logic will reside.

*   **Step 3.2: Implement/Refine `search_n8n_documentation` Tool**
    *   **Action:** Develop the `search_n8n_documentation` tool. This could use:
        *   A web search API (e.g., Google Search, Bing Search via an API like Serper) scoped to `site:docs.n8n.io`.
        *   A local vector store of the n8n documentation if you download and process it (more complex setup).
    *   **Rationale:** This tool is critical for the agent's ability to learn and adapt.

*   **Step 3.3: Craft the System Prompt**
    *   **Action:** Implement the detailed system prompt as outlined in `INTELLIGENT_N8N_WORKFLOW_BUILDER_AGENT_SPEC.md` within your chosen agent framework.
    *   **Rationale:** Guide the agent's behavior and reasoning.

*   **Step 3.4: Iterative Testing and Refinement**
    *   **Connecting Agent to Deployed Server:**
        *   The agent, when acting as an MCP client, will use an `mcp.json`-like configuration. This configuration will point to a local Supergateway instance running in SSE-to-stdio mode, which connects to the Railway-deployed `n8n-mcp-server`'s SSE endpoint (as described in Step 2.5).
        *   This allows the agent to use its `mcp_n8n_docker_direct_...` tools seamlessly against the remote server.
    *   **Initial Iteration:** For faster early iteration on agent logic, you can still have the agent use the *local* `n8n-mcp-server` (via the existing `docker run ... n8n-mcp-server-local` command in `mcp.json`, which itself now runs Supergateway and your stdio server within that local Docker instance). Then switch the `mcp.json` entry to target the deployed Railway SSE server for integration testing.
    *   **Rationale:** Develop and debug the agent's core capabilities using a flexible connection to either local or remote n8n MCP services.

### Phase 4: Remote Access and Client Connectivity (Achieved by Supergateway)

*   **Context:** The original "Phase 4" focused on setting up a generic stdio-tunneling solution (like "Supercolluder"). With Supergateway integrated directly into the `n8n-mcp-server` deployment, the server *already* exposes an SSE endpoint.
*   **Revised Focus:** This phase is now about ensuring clients can robustly connect to this existing SSE endpoint.
    *   **Client-Side Supergateway:** As detailed in Step 2.5 and 3.4, clients (Cursor, the agent) will typically use Supergateway locally in "SSE -> stdio" mode.
    *   **Native SSE MCP Clients:** If an MCP client has native support for SSE-based MCP servers, it could connect directly to the Railway URL without needing a local Supergateway instance. (This is less common for current tools like Cursor).
    *   **Documentation:** Document clearly for users of the deployed `n8n-mcp-server` how to configure their `mcp.json` (or other client settings) to connect via Supergateway (SSE->stdio).

*   **Step 4.1: Test Remote Interaction via Client-Side Supergateway**
    *   **Action:** Thoroughly test all `mcp_n8n_docker_direct_...` tools through an MCP client (e.g., Cursor) configured with the `npx supergateway --sse ...` command pointing to the Railway deployment.
    *   **Rationale:** Ensure the entire end-to-end remote setup (Client -> Local Supergateway -> Railway -> Deployed Supergateway -> n8n-mcp-server) is stable and performant.

## 3. Success Metrics for This Plan

*   `n8n-mcp-server` (wrapped by Supergateway) is successfully and reliably deployed to Railway, exposing an SSE endpoint.
*   The Railway deployment passes health checks via Supergateway's `/healthz` endpoint.
*   Local MCP clients (like Cursor) can connect to the deployed Railway SSE service using a local Supergateway instance in SSE-to-stdio mode.
*   The "Intelligent n8n Workflow Builder Agent" can be iterated upon, using its MCP client tools to connect to the deployed `n8n-mcp-server` via the same local Supergateway (SSE->stdio) mechanism.
*   The agent begins to show proficiency in using the documentation search tool and constructing basic n8n workflows using the remote server.

This updated plan leverages Supergateway for both serving SSE from Railway and for enabling clients to connect to that SSE feed, streamlining the remote access architecture. 