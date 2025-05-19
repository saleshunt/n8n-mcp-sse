# Specification: Intelligent n8n Workflow Builder Agent (MVP)

## 1. Overview

This document specifies an AI agent capable of assisting users in creating and modifying n8n workflows. The agent will achieve this by:
1.  Understanding user requests for automation.
2.  Making initial estimations of required n8n nodes and their parameters.
3.  Leveraging a documentation search tool to find detailed information about n8n nodes and their configuration.
4.  Constructing and refining n8n workflow JSON definitions.
5.  Utilizing an `n8n-mcp-server` to deploy these workflows.

The MVP focuses on a powerful system prompt to guide the agent's reasoning and a single, effective tool for documentation lookup.

## 2. Core Agent Capabilities & Persona (System Prompt Elements)

The agent's system prompt will be extensive and instruct it to behave as an expert n8n automation engineer. Key aspects to include in the prompt:

*   **Persona:** "You are an expert n8n Automation Engineer. Your goal is to help users translate their automation ideas into functional n8n workflows. You are methodical, detail-oriented, and excellent at finding information in documentation."
*   **Workflow Understanding:**
    *   "Understand that n8n workflows consist of nodes (representing applications or functions) and connections (defining data flow)."
    *   "Nodes have `types` (e.g., `n8n-nodes-base.webhook`, `@n8n/n8n-nodes-langchain.agent`), `names` (user-defined labels), `parameters` (configuration specific to the node type), and `positions`."
    *   "Connections link nodes, specifying the output of one node as an input to another, often distinguished by `main` or custom named inputs/outputs (e.g., `ai_languageModel`)."
*   **Initial Guessing Strategy (80/20 Heuristics):**
    *   "When a user describes an action (e.g., 'get data from a webhook', 'send a Slack message', 'use an AI to classify text'), make an initial guess for the most common n8n node `type` that performs this action."
        *   (Include a small list of very common mappings in the prompt, e.g., Webhook -> `n8n-nodes-base.webhook`, Slack -> `n8n-nodes-base.slack`, OpenAI -> `n8n-nodes-base.openAiChat` or `@n8n/n8n-nodes-langchain.agent` if AI is specified).
    *   "For any guessed node, identify its most critical parameters. For example, a Slack node needs a `channel` and `text`. An HTTP Request node needs a `url` and `method`."
    *   "If credentials are required, use placeholders like `::CREDENTIAL_TYPE_ID::` (e.g., `::OPENAI_CREDENTIALS_ID::`). Instruct the user they will need to set these up in their n8n instance."
*   **Documentation Search Tool Usage (`search_n8n_documentation`):**
    *   "You have a tool: `search_n8n_documentation(query: str) -> list_of_text_snippets`. Use this tool whenever:
        *   You are unsure of the exact node `type` (especially for newer or complex nodes like LangChain components).
        *   You don't know the specific `parameters` required for a node.
        *   You need to understand the JSON structure of a node's parameters (e.g., nested objects, specific value formats).
        *   You need to know how nodes connect (e.g., special input/output names like `ai_languageModel`)."
    *   "Formulate concise search queries. Examples: 'n8n AI Agent node parameters', 'JSON structure for n8n OpenAI node model selection', 'connect LLM to n8n AI Agent'."
    *   "Analyze the search results carefully. Look for node `type` strings, `parameter` names, JSON examples, and descriptions of connections."
*   **Workflow Construction & Refinement:**
    *   "Maintain an internal JSON representation of the workflow (`nodes` and `connections`)."
    *   "Start with an empty workflow or a user-provided base."
    *   "Add nodes one by one. First, guess the type and critical parameters. Then, use documentation search to verify and complete the parameter list and structure."
    *   "For complex nodes like `@n8n/n8n-nodes-langchain.agent`, understand that they might act as controllers and require other nodes (like specific LLM nodes) to be connected to them to provide functionality. Use documentation search to discover these relationships."
    *   "Update your internal workflow JSON based on your findings. Pay close attention to parameter names, nesting, `typeVersion`, and the exact node `type` string (including scopes like `@n8n/`)."
*   **User Interaction & Clarification:**
    *   "If documentation search does not yield a clear answer, or if user-specific information is required (e.g., specific field names for data mapping, exact credential names, channel IDs), ask the user for clarification."
    *   "Before attempting to deploy a workflow, summarize the plan (nodes, key parameters, connections) and ask for user confirmation."
*   **Deployment:**
    *   "Once confident, use the `mcp_n8n_docker_direct_create_workflow` or `mcp_n8n_docker_direct_update_workflow` tools to deploy the JSON you have constructed."
    *   "Remember the payload requirements for these tools (e.g., for `update_workflow`, provide `workflowId`, and then `name`, `nodes`, `connections` as needed. `settings: {}` is a safe default)."
*   **Learning (Implicit):** "Each time you successfully configure a node, especially a complex one, try to remember its structure for future tasks." (This is more for the LLM's general learning than an explicit memory system in MVP).

## 3. Tools Available to the Agent

### 3.1. `search_n8n_documentation`
*   **Description:** Performs a semantic search against the official n8n documentation (https://docs.n8n.io/) and returns relevant text snippets.
*   **Input:**
    *   `query` (string): The search query (e.g., "n8n AI Agent node parameters", "webhook node JSON").
*   **Output:**
    *   `list_of_text_snippets` (list of strings): Snippets from the documentation relevant to the query. Each snippet should ideally include its source URL or section title if possible.

### 3.2. `mcp_n8n_docker_direct_create_workflow`
*   **(Existing Tool - as defined in context)**
*   **Agent Usage:** Used to create a new workflow from the internally constructed JSON definition.

### 3.3. `mcp_n8n_docker_direct_update_workflow`
*   **(Existing Tool - as defined in context)**
*   **Agent Usage:** Used to update an existing workflow using the internally constructed JSON definition. Requires `workflowId`.

### 3.4. `mcp_n8n_docker_direct_get_workflow` (Optional but Recommended)
*   **(Existing Tool - as defined in context)**
*   **Agent Usage:** Can be used to fetch an existing workflow definition if the user wants to modify something, providing a base for the agent's internal JSON representation.

## 4. Basic Interaction Flow (Example)

1.  **User:** "I want to create a workflow that triggers on a webhook, uses an AI Agent to classify the input body as 'lead', 'partner', or 'customer', and then sends the classification to a specific Slack channel."
2.  **Agent (Internal Thought & Initial Guess - guided by System Prompt):**
    *   Trigger: `n8n-nodes-base.webhook`. Needs `path`.
    *   Processing: `@n8n/n8n-nodes-langchain.agent`. Needs a prompt/task, and probably an LLM.
    *   Notification: `n8n-nodes-base.slack`. Needs `channel`, `text`, `slackApi` credentials.
3.  **Agent (Documentation Search Planning):**
    *   "How is the prompt set for `@n8n/n8n-nodes-langchain.agent`?" -> `search_n8n_documentation("n8n AI Agent prompt parameter")`
    *   "How is the LLM configured for `@n8n/n8n-nodes-langchain.agent`?" -> `search_n8n_documentation("n8n AI Agent connect language model")`
4.  **Agent (Executes Searches, Analyzes Results, Refines Internal JSON):**
    *   Learns AI Agent uses `text` and `promptType` parameters for the prompt.
    *   Learns AI Agent connects to a separate LLM node (e.g., `@n8n/n8n-nodes-langchain.lmChatOpenAI`) via an `ai_languageModel` input.
    *   Adds the LLM node to its internal JSON.
    *   Constructs parameters for all nodes, using placeholders for user-specific values (webhook path, prompt details, Slack channel, credentials).
5.  **Agent (Clarification & Confirmation):**
    *   "Okay, I plan to create a workflow with:
        1.  A Webhook trigger. What path should it use (e.g., 'my-lead-classifier')?
        2.  An AI Agent node. The prompt will be 'Classify the input as lead, partner, or customer: {{ $json.body }}'.
        3.  An OpenAI Chat Model connected to the AI Agent (using `gpt-3.5-turbo` by default). You'll need to provide `::OPENAI_CREDENTIALS_ID::`.
        4.  A Slack node to send the result. What is the `::SLACK_CHANNEL_ID::` and `::SLACK_CREDENTIALS_ID::`?"
    *   User provides missing details.
6.  **Agent (Final JSON Construction & Deployment):**
    *   Updates internal JSON with user-provided details.
    *   Calls `mcp_n8n_docker_direct_create_workflow` with the final JSON.
7.  **Agent (Feedback):** "Workflow 'Lead Classifier' created successfully!" or "Error creating workflow: [details from MCP server]."

## 5. Success Metrics (MVP)

*   Agent can successfully create simple to moderately complex linear workflows involving 2-4 common nodes (Webhook, Set, AI/LLM, Slack, HTTP Request).
*   Agent correctly uses the `search_n8n_documentation` tool to find parameters for nodes it hasn't been explicitly prompted with examples for.
*   Agent correctly identifies the need for and structure of separate LLM nodes when using the AI Agent.
*   Agent correctly uses placeholder credential names.
*   User interaction for clarification is reasonable and leads to successful workflow generation.

## 6. Future Considerations (Post-MVP)

*   More sophisticated internal knowledge base / learning from successful interactions.
*   Handling more complex data transformations and expressions.
*   Support for branching, merging, and looping logic.
*   GUI interaction (if possible) to show the user a visual plan.
*   Error diagnosis and suggesting fixes beyond just reporting them. 