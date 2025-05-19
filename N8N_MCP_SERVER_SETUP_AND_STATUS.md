# n8n-mcp-server: Setup, Tool Status, and Troubleshooting

This document provides instructions for setting up the `n8n-mcp-server` for use with Cursor via Docker, a summary of the current n8n tool functionality, a root cause analysis for issues encountered, and recommended next steps.

## Phase 1: Ensure a Correct Docker Image for `n8n-mcp-server` is Built (Building from Local Source)

This phase details how to create a Docker image that correctly builds and runs the `n8n-mcp-server` from your local source code. This is the recommended approach for development and ensuring your latest code changes are deployed.

*   **Step 1.1: Verify/Create the Correct `Dockerfile` for `n8n-mcp-server`**
    *   **Location:** `C:\Users\dietl\VSCode Projects\speed_to_insight\n8n-mcp-server\Dockerfile` (Adjust path as per your local setup)
    *   **Content:**
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
        # Copy only necessary files from the builder stage
        COPY --from=builder /app/package.json /app/package-lock.json ./
        RUN npm ci --omit=dev --ignore-scripts
        COPY --from=builder /app/build ./build
        COPY --from=builder /app/node_modules ./node_modules

        # Environment variable to enable debug logs from the N8nApiClient
        ENV DEBUG true

        # Command to run the server (points to the built JS entry point)
        CMD ["node", "build/index.js"]
        ```
    *   **Action:** Ensure your `Dockerfile` matches this content. This Dockerfile uses a multi-stage build to create a lean production image containing only your built code and production dependencies.

*   **Step 1.2: Build the Docker Image**
    *   **Command (run in PowerShell, in the `n8n-mcp-server` directory):**
        ```powershell
        docker build -t n8n-mcp-server-local .
        ```
    *   **Expected Outcome:** The command completes successfully, creating a local Docker image named `n8n-mcp-server-local`.
    *   **Verification (Optional):** Run `docker images` in PowerShell to see `n8n-mcp-server-local` listed.

## Phase 2: Configure Cursor's `mcp.json` to Use This Docker Image

This phase explains how to configure Cursor to launch and communicate with the Dockerized `n8n-mcp-server`.

*   **Step 2.1: Edit `mcp.json`**
    *   **File Location:** `c:\Users\dietl\.cursor\mcp.json` (Adjust path as per your OS and user)
    *   **Action:** Open this file and add or modify an entry within the `"mcpServers": {}` object.
    *   **JSON Entry to Add/Modify:**
        ```json
            "n8n_docker_direct": {
              "command": "docker",
              "args": [
                "run", "--rm", "-i",
                "-e", "N8N_API_URL=https://primary-production-d902.up.railway.app/api/v1",
                "-e", "N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlZjI4NjdjZC0xNmNjLTQxZWYtYTU1Mi05Mjk1ZWU5ZTFiN2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzQ3NDQwMDYyfQ.y0wO9czCQxel5Iub3zeSZ6z32blyaXAtsHYDUXSpGu8",
                "-e", "N8N_WEBHOOK_USERNAME=someuser",
                "-e", "N8N_WEBHOOK_PASSWORD=somepassword",
                "-e", "DEBUG=true",
                "n8n-mcp-server-local"
              ],
              "disabled": false,
              "alwaysAllow": [
                "mcp_n8n_docker_direct_list_workflows", 
                "mcp_n8n_docker_direct_get_workflow",
                "mcp_n8n_docker_direct_create_workflow",
                "mcp_n8n_docker_direct_update_workflow",
                "mcp_n8n_docker_direct_delete_workflow",
                "mcp_n8n_docker_direct_activate_workflow",
                "mcp_n8n_docker_direct_deactivate_workflow"
              ],
              "timeout": 300 
            }
        ```
        *   **Note on Image Name**: Changed from `n8n-mcp-server-npm` to `n8n-mcp-server-local` to reflect the new build process.
        *   **Note on `alwaysAllow`**: List the exact tool names as they appear in Cursor.
        *   **Note on Environment Variables**: Ensure your `N8N_API_URL` and `N8N_API_KEY` are current and correct. `DEBUG=true` is important for seeing detailed logs from the server's `N8nApiClient` via `stderr`.
    *   **Placement:** Ensure correct JSON syntax if other servers are already defined.
    *   Save the `mcp.json` file.

## Phase 3: Test in Cursor

After configuring, test the integration within Cursor.

*   **Step 3.1: Reload MCP Servers in Cursor**
    *   Restart Cursor completely.
    *   Alternatively, use a command like "Developer: Reload MCP Servers" from the command palette if available.

*   **Step 3.2: Activate and Use the `n8n_docker_direct` Server**
    *   In Cursor, access the MCP server list.
    *   Enable `n8n_docker_direct`.
    *   Invoke a tool, e.g., `@n8n_docker_direct list workflows`.

*   **Step 3.3: Observe Logs**
    *   Check Cursor's MCP Output/Inspector for communication logs from the MCP client (`rect:` prefixed logs).
    *   Check your Docker container's logs for output from the `n8n-mcp-server` itself (e.g., `[N8nApiClient DEBUG]` messages).
        ```powershell
        docker logs <container_id_or_name> 
        ```
        (You can get the container ID from Docker Desktop or `docker ps`)

**Expected Outcome for Phase 3:**
Cursor successfully executes `docker run ... n8n-mcp-server-local`, the container starts, `n8n-mcp-server` communicates via JSON-RPC over `stdio`, and tool requests receive correct responses. Debug logs from the server appear on `stderr` and can be viewed via `docker logs`.

## n8n Tooling Status (via `n8n_docker_direct` MCP Server)

Based on recent testing:

*   `mcp_n8n_docker_direct_list_workflows`: **SUCCESS**
*   `mcp_n8n_docker_direct_get_workflow`: **SUCCESS**
*   `mcp_n8n_docker_direct_create_workflow`: **SUCCESS**
*   `mcp_n8n_docker_direct_update_workflow`: **SUCCESS** (Root cause of previous failures identified and resolved)
*   `mcp_n8n_docker_direct_activate_workflow`: **SUCCESS**
*   `mcp_n8n_docker_direct_deactivate_workflow`: **SUCCESS**
*   `mcp_n8n_docker_direct_delete_workflow`: **SUCCESS**
*   `mcp_n8n_docker_direct_list_executions`: **SUCCESS**
*   `mcp_n8n_docker_direct_get_execution`: **NOT TESTED** (requires an execution ID)
*   `mcp_n8n_docker_direct_delete_execution`: **NOT TESTED** (requires an execution ID)

## Root Cause Analysis: Previous `update_workflow` Tool Failures

The `mcp_n8n_docker_direct_update_workflow` tool previously and persistently failed with an "MCP error 1003: request/body must NOT have additional properties" error, or the MCP client would report "Unexpected token" errors.

**Primary Root Cause Identified (May 18, 2025):**
The primary issue was **interference of `console.error` logging with the JSON-RPC communication protocol used by the MCP client**. The `n8n-mcp-server` communicates with the MCP client (e.g., Cursor) via `stdio` (standard input/output). The MCP client expects well-formed JSON-RPC messages on `stdout`.

When `console.error()` calls within the `n8n-mcp-server` wrote debug messages to `stderr`, under certain conditions (especially at server startup or during the processing of a tool call if the timing was unfortunate), this output seemed to be captured or interpreted by the MCP client framework in a way that corrupted the expected JSON-RPC response from `stdout`. This led to:
1.  **"Unexpected token '...'" errors:** The MCP client would try to parse a string that was a mix of JSON and our debug messages, failing.
2.  **Misleading "additional properties" errors:** Even if the n8n API call itself was successful, if the MCP client couldn't parse the success response from the `n8n-mcp-server` (due to `stderr` interference), it might fall back to reporting the last known error or a generic error, which in many earlier attempts was the "additional properties" error stemming from incorrect payload construction (which was a separate, earlier issue that had been fixed in the `update.ts` code but was masked by the logging problem).

**Secondary/Historical Issues (Now Resolved):**
*   **Incorrect Docker Build:** Initially, the Docker image was being built using `npm install -g n8n-mcp-server`, which pulled the published npm package, not the local source code with our fixes. This was corrected by implementing a multi-stage Dockerfile that builds from local source.
*   **Payload Construction for `update_workflow`:** The `update.ts` handler initially sent too many properties in the PUT request to the n8n API. This was refined to send only `name`, `nodes`, `connections`, and a minimal `settings: {}` object, which is the correct payload.

By significantly reducing `console.error` logging (especially at startup and from core client/service logic) and ensuring the Docker image was built from local, corrected code, the `update_workflow` tool became fully operational.

## Recommended Next Steps

1.  **Implement Robust Logging Strategy:**
    *   Avoid direct `console.log` or `console.error` in the main execution path of the server once JSON-RPC communication has started.
    *   Use a dedicated logging library (e.g., `winston`, `pino`) configured to output to `stderr` or a log file. This provides better control over log levels, formatting, and destinations.
    *   Continue to use the `DEBUG` environment variable to control the verbosity of logs.
2.  **Test Full Workflow Modification:** Perform a comprehensive test of the `update_workflow` tool by making significant changes, such as adding, removing, and modifying nodes and connections (e.g., fully implement the OpenAI node integration).
3.  **Test Remaining Untested Tools:** If execution data is available, test `get_execution` and `delete_execution`.
4.  **Review and Refine All Tool Handlers:** Given the insights from debugging `update_workflow`, briefly review other tool handlers for any potentially problematic logging or payload construction, though most seem to be working correctly.

## Work Log / Troubleshooting Journey

*   **Initial Setup & Testing:** Basic tools (`list`, `get`, `create`, `activate`, `deactivate`, `delete`) worked. `update_workflow` failed with "additional properties".
*   **`update.ts` Refinement (Payload):** Iteratively refined the payload in `n8n-mcp-server/src/tools/workflow/update.ts` to send only `name`, `nodes`, `connections`, and `settings: {}`, based on n8n API documentation and direct API testing. This fixed the payload issue, but the tool still failed via MCP.
*   **Direct API Test Script (`test_n8n_update.mjs`):** Created a Node.js script to call the n8n API directly. This script successfully updated the workflow name, proving the n8n API endpoint and the minimal payload were correct. This shifted suspicion to the `n8n-mcp-server` or its interaction with the MCP client.
*   **Code Review (`n8n-client.ts`, `client.ts`):** Reviewed the API client and service layers; they appeared to pass data through correctly.
*   **Intensive Logging Addition:** Added extensive `console.error` logging throughout `update.ts`, `n8n-client.ts`, and `client.ts` to trace the request.
*   **Docker Rebuilds & Caching Suspicions:** Multiple attempts to rebuild the Docker image, suspecting caching issues were preventing updated code from running.
*   **Dockerfile RCA (The "NPM Install" Issue):** Discovered the `Dockerfile` was using `RUN npm install -g n8n-mcp-server`, which always fetched the published version from npm, ignoring local changes.
*   **Dockerfile Fix (Build from Local Source):** Changed `Dockerfile` to a multi-stage build that copies local source, installs dependencies, and runs `npm run build`. This ensured local code changes were deployed in the Docker image.
*   **MCP Client "Unexpected Token" Errors:** After fixing the Dockerfile, new errors from the `rect:` (MCP client) layer appeared: "Unexpected token 'N'..." or similar, indicating malformed JSON. These errors correlated with our `console.error` logs.
*   **Logging Interference Hypothesis:** Formed the hypothesis that `console.error` output to `stderr` was interfering with the MCP client's parsing of JSON-RPC messages from `stdout`.
*   **Systematic Logging Reduction:** Began commenting out `console.error` statements, starting from server initialization and then within the API client and tool handler logic.
*   **Breakthrough:** After commenting out most `console.error` calls (leaving only essential Axios debug logs and a single critical payload log in `update.ts`), the `update_workflow` tool finally succeeded via the MCP client. This confirmed the logging interference was the primary blocker for the MCP client successfully interpreting the server's responses.
*   **Current Status:** `update_workflow` is functional. The key remaining `console.error` logs are the Axios debug interceptors (enabled by `ENV DEBUG=true`) and one specific log in `update.ts` showing the constructed payload.

By addressing the Docker build process and the logging interference, the `update_workflow` tool is now operational.