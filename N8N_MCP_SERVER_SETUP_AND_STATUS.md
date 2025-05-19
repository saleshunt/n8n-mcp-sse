# n8n-mcp-server: Setup, Tool Status, and Troubleshooting

This document provides instructions for setting up the `n8n-mcp-server` for use with Cursor via Docker, a summary of the current n8n tool functionality, a root cause analysis for issues encountered, and recommended next steps.

## Phase 1: Ensure a Correct Docker Image for `n8n-mcp-server` is Built (Building from Local Source with Supergateway)

This phase details how to create a Docker image that correctly builds and runs the `n8n-mcp-server` from your local source code, with Supergateway wrapping it to provide an SSE interface.

*   **Step 1.1: Verify/Create the Correct `Dockerfile` for `n8n-mcp-server`**
    *   **Location:** `C:\Users\dietl\VSCode Projects\speed_to_insight\n8n-mcp-server\Dockerfile` (Adjust path as per your local setup)
    *   **Content (ensure it matches the Supergateway version):**
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

        EXPOSE 8000 

        CMD ["sh", "-c", "npx -y supergateway --stdio \\\"node build/index.js\\\" --port 8000 --healthEndpoint /healthz --cors --logLevel info"]
        ```
    *   **Action:** Ensure your `Dockerfile` matches this content. This Dockerfile now includes Supergateway in the `CMD` line.

*   **Step 1.2: Build the Docker Image for Local Testing**
    *   **Command (run in PowerShell, in the `n8n-mcp-server` directory):**
        ```powershell
        docker build -t n8n-mcp-server-supergateway-local .
        ```
    *   **Expected Outcome:** Creates a local Docker image named `n8n-mcp-server-supergateway-local`.
    *   **Rationale:** This image is for local testing of the Supergateway setup before deploying to Railway or for local development of the n8n-mcp-server itself.

## Phase 2: Configure Cursor's `mcp.json` to Use `n8n-mcp-server`

This phase explains how to configure Cursor to communicate with the `n8n-mcp-server`.

*   **Option A: Connecting to the Railway-Deployed SSE Server (Recommended for using the deployed instance)**
    *   **Pre-requisite:** The `n8n-mcp-server` is deployed to Railway and you have its public SSE URL (e.g., `https://<your-app>.railway.app/sse`).
    *   **Action:** Edit `mcp.json` (e.g., `c:\Users\dietl\.cursor\mcp.json`).
    *   **JSON Entry:**
        ```json
            "n8n_railway_sse": {
              "command": "npx",
              "args": [
                "-y",
                "supergateway",
                "--sse", "https://<YOUR_RAILWAY_APP_URL>/sse", // <-- REPLACE THIS
                "--logLevel", "info"
                // Add --header or --oauth2Bearer flags here if auth is configured on the Railway Supergateway
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
                // Add other n8n tools as needed
              ],
              "timeout": 300 
            }
        ```
    *   **Explanation:** Cursor will run Supergateway locally. This local Supergateway connects to your *remote* Railway SSE endpoint and translates the SSE communication back to stdio, which Cursor understands.

*   **Option B: Connecting to a Locally Running Dockerized Server (For local development/testing of the server)**
    *   **Action:** Edit `mcp.json`.
    *   **JSON Entry:**
        ```json
            "n8n_docker_local_supergateway": {
              "command": "docker",
              "args": [
                "run", "--rm", "-i",
                "-e", "PORT=8080", // Example: local supergateway listens on 8080
                "-e", "N8N_API_URL=YOUR_N8N_API_URL", // Replace
                "-e", "N8N_API_KEY=YOUR_N8N_API_KEY",   // Replace
                "-e", "N8N_WEBHOOK_USERNAME=someuser",
                "-e", "N8N_WEBHOOK_PASSWORD=somepassword",
                "-e", "DEBUG=true",
                "-p", "8080:8080", // Map the host port to the container port Supergateway uses
                "n8n-mcp-server-supergateway-local" // The image built in Step 1.2
              ],
              "disabled": false,
              "alwaysAllow": [/* ...list tools... */],
              "timeout": 300 
            }
        ```
    *   **Explanation:** This runs your `n8n-mcp-server-supergateway-local` Docker image. Supergateway inside this container starts your `n8n-mcp-server` and exposes it on port 8080 (example). Cursor *cannot directly talk SSE*. So, to use *this* local setup with Cursor, you would *still* need another `mcp.json` entry that uses Supergateway in SSE-to-stdio mode, pointing to `http://localhost:8080/sse`.
        ```json
            "n8n_local_docker_via_local_sg_bridge": {
              "command": "npx",
              "args": [
                "-y", "supergateway",
                "--sse", "http://localhost:8080/sse", // Points to the SSE from the Docker container above
                "--logLevel", "info"
              ],
              "disabled": false,
              "alwaysAllow": [/* ...list tools... */],
              "timeout": 300
            }
        ```
    *   This setup is more complex for direct Cursor use; Option A is preferred for connecting to the deployed instance. Option B (running the Docker image directly) is primarily for testing the Docker image itself and server functionality locally before deployment, perhaps testing its SSE output with `curl` or a dedicated SSE client.

## Phase 3: Test in Cursor (Connecting to Deployed Railway Instance)

*   **Step 3.1: Reload MCP Servers in Cursor**
    *   Restart Cursor or use "Developer: Reload MCP Servers".

*   **Step 3.2: Activate and Use the `n8n_railway_sse` Server**
    *   In Cursor, enable `n8n_railway_sse` (or whatever you named it in `mcp.json` using Option A).
    *   Invoke a tool, e.g., `@n8n_railway_sse list workflows`.

*   **Step 3.3: Observe Logs**
    *   Cursor's MCP Output/Inspector.
    *   Railway deployment logs for the `n8n-mcp-server` (shows logs from deployed Supergateway and your `node build/index.js`).
    *   If debugging the local Supergateway bridge, check the terminal where `npx supergateway --sse ...` is implicitly run by Cursor.

**Expected Outcome for Phase 3 (with Railway):**
Cursor, using its local Supergateway bridge, successfully communicates with the Supergateway instance on Railway, which in turn communicates with your `n8n-mcp-server` via stdio. Tool requests receive correct responses.

## n8n Tooling Status (via `n8n_docker_direct` MCP Server)

Based on recent testing (via local Docker SSE setup connected directly to Cursor):

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

*   **Dockerfile `EXPOSE` Error (May 19, 2025):** Encountered `ERROR: failed to solve: invalid containerPort: #` during `docker build`. Caused by using shell expansion `${PORT:-8000}` in the `EXPOSE` instruction. Fixed by changing `EXPOSE ${PORT:-8000}` to `EXPOSE 8000`.
*   **Dockerfile `npm ci` / `prepare` Script Error (May 19, 2025):** `docker build` failed during `RUN npm ci` because the `prepare` script in `package.json` (which ran `npm run build`) was executed before source files were copied. `tsc` failed as it had no input. Fixed by changing `RUN npm ci` to `RUN npm ci --ignore-scripts` in the builder stage of the Dockerfile.
*   **Successful Local Docker SSE Test (May 19, 2025):**
    *   Successfully built the Docker image (`n8n-mcp-server-supergateway`) with the multi-stage Dockerfile including Supergateway.
    *   Ran the container locally, mapping port 8000.
    *   Supergateway started correctly and wrapped the `n8n-mcp-server`.
    *   The `/healthz` endpoint (`http://localhost:8000/healthz`) returned an OK status.
    *   Configured Cursor's `mcp.json` with a new entry (`n8n_local_docker_sse`) using the direct SSE URL (`http://localhost:8000/sse`).
    *   Successfully listed workflows in Cursor via the local Dockerized SSE server.
*   **Current Overall Status:** Local Docker deployment with Supergateway exposing an SSE interface is validated and working correctly with Cursor. Ready for Railway deployment.

By addressing the Docker build process and the logging interference, the `update_workflow` tool is now operational.