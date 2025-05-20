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
*   **Documentation and Web Search Strategy:**
    *   "You have general web search capabilities. Use these to consult the official n8n documentation (https://docs.n8n.io/) and other reliable web sources whenever:
        *   You are unsure of the exact node `type` (especially for newer or complex nodes like LangChain components).
        *   You don't know the specific `parameters` required for a node.
        *   You need to understand the JSON structure of a node's parameters (e.g., nested objects, specific value formats).
        *   You need to know how nodes connect (e.g., special input/output names like `ai_languageModel`).
        *   You encounter errors or unexpected behavior during workflow design or after attempted deployment, to find solutions or explanations."
    *   "Formulate concise search queries. Examples: 'n8n AI Agent node parameters', 'JSON structure for n8n OpenAI node model selection', 'connect LLM to n8n AI Agent', 'n8n error "propertyValues[itemName] is not iterable" fix'."
    *   "Analyze the search results carefully. Look for node `type` strings, `parameter` names, JSON examples, descriptions of connections, and troubleshooting guides."
    *   "Iteratively refine your understanding and workflow JSON based on search findings."
*   **Workflow Construction & Refinement:**
    *   "Maintain an internal JSON representation of the workflow (`nodes` and `connections`)."
    *   "Start with an empty workflow or a user-provided base."
    *   "Add nodes one by one. First, guess the type and critical parameters. Then, use web search and the n8n documentation to verify and complete the parameter list and structure."
    *   "For complex nodes like `@n8n/n8n-nodes-langchain.agent`, understand that they might act as controllers and require other nodes (like specific LLM nodes) to be connected to them to provide functionality. Use web search to discover these relationships and their configuration."
    *   "Update your internal workflow JSON based on your findings. Pay close attention to parameter names, nesting, `typeVersion`, and the exact node `type` string (including scopes like `@n8n/`)."
*   **User Interaction & Clarification:**
    *   "If web searches and documentation review do not yield a clear answer, or if user-specific information is required (e.g., specific field names for data mapping, exact credential names, channel IDs), ask the user for clarification."
    *   "Before attempting to deploy a workflow, summarize the plan (nodes, key parameters, connections) and ask for user confirmation."
*   **Deployment:**
    *   "Once confident, use the `mcp_n8n_docker_direct_create_workflow` or `mcp_n8n_docker_direct_update_workflow` tools to deploy the JSON you have constructed."
    *   "Remember the payload requirements for these tools (e.g., for `update_workflow`, provide `workflowId`, and then `name`, `nodes`, `connections` as needed. `settings: {}` is a safe default)."
    *   "When connecting to an `n8n-mcp-server` that has been deployed (e.g., to Railway) and is exposed via SSE using Supergateway, the MCP client used by the agent will need to be configured accordingly. Typically, this involves using Supergateway locally in SSE-to-stdio mode, where the `mcp.json` (or equivalent) command is `npx supergateway --sse <REMOTE_SSE_URL>`. The agent's use of the `mcp_n8n_docker_direct_...` tools remains the same, but the underlying connection is bridged by Supergateway."
*   **Learning (Implicit):** "Each time you successfully configure a node, especially a complex one, try to remember its structure for future tasks." (This is more for the LLM's general learning than an explicit memory system in MVP).

## 3. Tools Available to the Agent

### 3.1. `mcp_n8n_docker_direct_create_workflow`
*   **Agent Usage:** Used to create a new workflow from the internally constructed JSON definition.

### 3.2. `mcp_n8n_docker_direct_update_workflow`
*   **Agent Usage:** Used to update an existing workflow using the internally constructed JSON definition. Requires `workflowId`.

### 3.3. `mcp_n8n_docker_direct_get_workflow` (Optional but Recommended)
*   **Agent Usage:** Can be used to fetch an existing workflow definition if the user wants to modify something, providing a base for the agent's internal JSON representation.

## 4. Basic Interaction Flow (Example)

1.  **User:** "I want to create a workflow that triggers on a webhook, uses an AI Agent to classify the input body as 'lead', 'partner', or 'customer', and then sends the classification to a specific Slack channel."
2.  **Agent (Internal Thought & Initial Guess - guided by System Prompt):**
    *   Trigger: `n8n-nodes-base.webhook`. Needs `path`.
    *   Processing: `@n8n/n8n-nodes-langchain.agent`. Needs a prompt/task, and probably an LLM.
    *   Notification: `n8n-nodes-base.slack`. Needs `channel`, `text`, `slackApi` credentials.
3.  **Agent (Documentation Search Planning - using Web Search):**
    *   "How is the prompt set for `@n8n/n8n-nodes-langchain.agent`?" -> Plan to web search: "n8n AI Agent prompt parameter"
    *   "How is the LLM configured for `@n8n/n8n-nodes-langchain.agent`?" -> Plan to web search: "n8n AI Agent connect language model"
4.  **Agent (Executes Web Searches, Analyzes Results, Refines Internal JSON):**
    *   Learns AI Agent uses `text` and `promptType` parameters for the prompt from n8n documentation.
    *   Learns AI Agent connects to a separate LLM node (e.g., `@n8n/n8n-nodes-langchain.lmChatOpenAI`) via an `ai_languageModel` input from n8n documentation or community forums.
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
*   Agent correctly uses its web search capabilities to find parameters for nodes it hasn't been explicitly prompted with examples for, by consulting official n8n documentation or other reliable sources.
*   Agent correctly identifies the need for and structure of separate LLM nodes when using the AI Agent by searching and analyzing documentation.
*   Agent correctly uses placeholder credential names.
*   User interaction for clarification is reasonable and leads to successful workflow generation.

## 6. Future Considerations (Post-MVP)

*   More sophisticated internal knowledge base / learning from successful interactions.
*   Handling more complex data transformations and expressions.
*   Support for branching, merging, and looping logic.
*   GUI interaction (if possible) to show the user a visual plan.
*   Error diagnosis and suggesting fixes beyond just reporting them. 

```markdown
# Comprehensive Guide to n8n Workflows with MCP

## Table of Contents
1. [Introduction to n8n Workflows](#1-introduction-to-n8n-workflows)
2. [Understanding JSON Workflow Structure](#2-understanding-json-workflow-structure)
3. [MCP Tool API Functions](#3-mcp-tool-api-functions)
4. [Creating Workflows Step-by-Step](#4-creating-workflows-step-by-step)
5. [Updating Existing Workflows](#5-updating-existing-workflows)
6. [Common Node Types and Parameters](#6-common-node-types-and-parameters)
7. [Connection Management](#7-connection-management)
8. [Troubleshooting Common Errors](#8-troubleshooting-common-errors)
9. [Complete Workflow Example](#9-complete-workflow-example)

## 1. Introduction to n8n Workflows

n8n is a workflow automation platform that allows you to connect various services and automate tasks using a visual interface. Under the hood, workflows are represented as JSON objects with specific structures. The MCP tool provides functions to create, retrieve, update, and manage these workflows programmatically.

## 2. Understanding JSON Workflow Structure

Every n8n workflow consists of these key components:

- **name**: The display name of the workflow
- **nodes**: Array of node objects that define what the workflow does
- **connections**: Object defining how nodes connect to each other
- **active**: Boolean indicating if the workflow is running
- **id**: Unique identifier (generated automatically)

### 2.1 Node Structure

Each node has this structure:

```json
{
  "id": "unique-node-id",
  "name": "Human-Readable Name",
  "type": "n8n-nodes-base.nodeType",
  "position": [x, y],
  "parameters": {
    // Node-specific parameters
  },
  "typeVersion": 1.0
}
```

- **id**: Unique string identifier (can be any unique string)
- **name**: Display name shown in the UI
- **type**: Node type identifier (format: `n8n-nodes-base.nodeType`)
- **position**: Array with [x, y] coordinates on the canvas
- **parameters**: Object containing node-specific settings
- **typeVersion**: Version number of the node type

### 2.2 Connection Structure

Connections define how data flows between nodes:

```json
"connections": {
  "Source Node Name": {
    "main": [
      [
        {
          "node": "Target Node Name",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

- The outer key is the source node name
- `main` array contains arrays of connections (for multiple outputs)
- Each connection specifies the target node, type, and index

## 3. MCP Tool API Functions

The MCP tool provides these core functions:

### 3.1 Create Workflow

```javascript
create_workflow({
  "name": "Workflow Name",
  "nodes": [...],
  "connections": {...}
})
```

### 3.2 Get Workflow

```javascript
get_workflow({
  "workflowId": "workflow-id-here"
})
```

### 3.3 Update Workflow

```javascript
update_workflow({
  "workflowId": "workflow-id-here",
  "nodes": [...],
  "connections": {...},
  "name": "Updated Name" // optional
})
```

### 3.4 List Workflows

```javascript
list_workflows({
  "includeActive": true // optional
})
```

### 3.5 Activate Workflow

```javascript
activate_workflow({
  "workflowId": "workflow-id-here"
})
```

### 3.6 Deactivate Workflow

```javascript
deactivate_workflow({
  "workflowId": "workflow-id-here"
})
```

## 4. Creating Workflows Step-by-Step

Follow this methodical approach for creating workflows with the MCP tool:

### 4.1 Planning Stage

1. Identify workflow purpose and required steps
2. List required node types and their connections
3. Determine parameters needed for each node

### 4.2 Implementation Stage

#### Step 1: Define Nodes Array

Create an array of node objects with unique IDs:

```javascript
const nodes = [
  {
    "id": "start-node-id",
    "name": "Start Node",
    "type": "n8n-nodes-base.manualTrigger",
    "position": [250, 300],
    "parameters": {},
    "typeVersion": 1
  },
  {
    "id": "process-node-id",
    "name": "Process Data",
    "type": "n8n-nodes-base.set",
    "position": [450, 300],
    "parameters": {
      "values": {
        "string": [
          {
            "name": "outputField",
            "value": "Output Value"
          }
        ]
      }
    },
    "typeVersion": 1
  }
]
```

#### Step 2: Define Connections Object

```javascript
const connections = {
  "Start Node": {
    "main": [
      [
        {
          "node": "Process Data",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

#### Step 3: Create the Workflow

```javascript
const result = create_workflow({
  "name": "My First Workflow",
  "nodes": nodes,
  "connections": connections
})
```

## 5. Updating Existing Workflows

### 5.1 Get Current Workflow

```javascript
const workflow = get_workflow({
  "workflowId": "your-workflow-id"
})
```

### 5.2 Modify Nodes or Connections

```javascript
// Add new node
workflow.nodes.push({
  "id": "new-node-id",
  "name": "New Node",
  "type": "n8n-nodes-base.noOp",
  "position": [650, 300],
  "parameters": {},
  "typeVersion": 1
})

// Update connections
workflow.connections["Process Data"] = {
  "main": [
    [
      {
        "node": "New Node",
        "type": "main",
        "index": 0
      }
    ]
  ]
}
```

### 5.3 Update the Workflow

```javascript
const updateResult = update_workflow({
  "workflowId": workflow.id,
  "nodes": workflow.nodes,
  "connections": workflow.connections
})
```

## 6. Common Node Types and Parameters

### 6.1 Trigger Nodes

**Manual Trigger**
```json
{
  "id": "trigger-id",
  "name": "Manual Trigger",
  "type": "n8n-nodes-base.manualTrigger",
  "position": [250, 300],
  "parameters": {},
  "typeVersion": 1
}
```

**Schedule Trigger**
```json
{
  "id": "schedule-id",
  "name": "Schedule Trigger",
  "type": "n8n-nodes-base.scheduleTrigger",
  "position": [250, 300],
  "parameters": {
    "triggerTimes": {
      "item": [
        {
          "mode": "everyWeek",
          "hour": 9,
          "minute": 0,
          "weekDay": 1
        }
      ]
    }
  },
  "typeVersion": 1
}
```

**Webhook Trigger**
```json
{
  "id": "webhook-id",
  "name": "Webhook",
  "type": "n8n-nodes-base.webhook",
  "position": [250, 300],
  "parameters": {
    "path": "my-webhook",
    "httpMethod": "POST",
    "options": {
      "responseMode": "responseNode"
    }
  },
  "webhookId": "unique-webhook-id",
  "typeVersion": 1
}
```

### 6.2 Processing Nodes

**Set Node**
```json
{
  "id": "set-id",
  "name": "Set",
  "type": "n8n-nodes-base.set",
  "position": [450, 300],
  "parameters": {
    "values": {
      "string": [
        {
          "name": "fieldName",
          "value": "fieldValue"
        }
      ],
      "number": [
        {
          "name": "numericField",
          "value": 42
        }
      ]
    },
    "options": {},
    "keepOnlySet": false
  },
  "typeVersion": 1
}
```

**Function Node**
```json
{
  "id": "function-id",
  "name": "Function",
  "type": "n8n-nodes-base.function",
  "position": [650, 300],
  "parameters": {
    "functionCode": "// Add code here\nreturn items.map(item => {\n  item.json.newField = 'processed';\n  return item;\n});"
  },
  "typeVersion": 1
}
```

**HTTP Request Node**
```json
{
  "id": "http-id",
  "name": "HTTP Request",
  "type": "n8n-nodes-base.httpRequest",
  "position": [850, 300],
  "parameters": {
    "url": "https://api.example.com/data",
    "method": "GET",
    "authentication": "none",
    "options": {}
  },
  "typeVersion": 1
}
```

### 6.3 AI Nodes

**AI Agent Node**
```json
{
  "id": "ai-agent-id",
  "name": "AI Agent",
  "type": "@n8n/n8n-nodes-langchain.agent",
  "position": [450, 300],
  "parameters": {
    "prompt": {
      "mode": "defineBelow",
      "schema": {
        "type": "object",
        "properties": {
          "category": {
            "type": "string",
            "enum": ["Option1", "Option2", "Option3"]
          },
          "confidence": {
            "type": "number"
          }
        }
      },
      "userMessageContent": "Analyze this: {{$json.input}}",
      "systemMessageContent": "You are an AI assistant designed to classify content."
    },
    "options": {
      "model": {
        "modelName": "gpt-4",
        "temperature": 0.2
      }
    }
  },
  "typeVersion": 1.9
}
```

## 7. Connection Management

### 7.1 Simple Linear Flow

```json
"connections": {
  "Trigger Node": {
    "main": [
      [
        {
          "node": "Process Node",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Process Node": {
    "main": [
      [
        {
          "node": "Final Node",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

### 7.2 Branching Flow (If Node)

```json
"connections": {
  "If Node": {
    "main": [
      [
        {
          "node": "True Path Node",
          "type": "main",
          "index": 0
        }
      ],
      [
        {
          "node": "False Path Node",
          "type": "main",
          "index": 0
        }
      ]
    ]
  }
}
```

### 7.3 Multiple Inputs (Merge Node)

```json
"connections": {
  "Path A": {
    "main": [
      [
        {
          "node": "Merge Node",
          "type": "main",
          "index": 0
        }
      ]
    ]
  },
  "Path B": {
    "main": [
      [
        {
          "node": "Merge Node",
          "type": "main",
          "index": 1
        }
      ]
    ]
  }
}
```

## 8. Troubleshooting Common Errors

### 8.1 "propertyValues[itemName] is not iterable" Error

This error commonly occurs when:

1. **Node parameters are improperly formatted**
   - Solution: Ensure all array or object parameters are correctly structured

2. **Incompatible node versions**
   - Solution: Check typeVersion matches the available node version

3. **AI nodes have incorrect parameter structure**
   - Solution: Verify AI node parameters match the expected format

Example of correct AI node parameter structure:
```json
"parameters": {
  "prompt": {
    "mode": "defineBelow",
    "schema": {
      "type": "object",
      "properties": {
        "result": {
          "type": "string"
        }
      }
    },
    "userMessageContent": "Process this: {{$json.input}}",
    "systemMessageContent": "You are an assistant."
  },
  "options": {
    "model": {
      "modelName": "gpt-4",
      "temperature": 0.2
    }
  }
}
```

### 8.2 Node Not Found Error

- Verify the node type string is correct (e.g., "n8n-nodes-base.httpRequest")
- Check if the node requires installation of additional packages

### 8.3 Connection Errors

- Ensure node names in connections match exactly with node names in the nodes array
- Check that referenced nodes exist
- Verify indices are valid (usually starting at 0)

## 9. Complete Workflow Example

Here's a complete workflow example that combines multiple node types:

```javascript
// Define a lead classification workflow
const workflowData = {
  "name": "Lead Classification Pipeline",
  "nodes": [
    {
      "id": "webhook-node",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "parameters": {
        "path": "new-lead",
        "httpMethod": "POST",
        "options": {
          "responseMode": "responseNode"
        }
      },
      "webhookId": "lead-classification-webhook",
      "typeVersion": 1
    },
    {
      "id": "set-node",
      "name": "Format Lead Data",
      "type": "n8n-nodes-base.set",
      "position": [450, 300],
      "parameters": {
        "values": {
          "string": [
            {
              "name": "leadName",
              "value": "={{$json.body.name || 'Unknown'}}"
            },
            {
              "name": "leadEmail",
              "value": "={{$json.body.email || 'Unknown'}}"
            },
            {
              "name": "leadCompany",
              "value": "={{$json.body.company || 'Unknown'}}"
            },
            {
              "name": "analysisPrompt",
              "value": "Classify this lead based on the following information:\nName: {{$json.body.name}}\nEmail: {{$json.body.email}}\nCompany: {{$json.body.company}}\nMessage: {{$json.body.message}}"
            }
          ]
        },
        "options": {},
        "keepOnlySet": false
      },
      "typeVersion": 1
    },
    {
      "id": "ai-node",
      "name": "Classify Lead",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "position": [650, 300],
      "parameters": {
        "prompt": {
          "mode": "defineBelow",
          "schema": {
            "type": "object",
            "required": ["category", "confidence", "nextSteps"],
            "properties": {
              "category": {
                "type": "string",
                "enum": ["Hot Lead", "Warm Lead", "Cold Lead"]
              },
              "confidence": {
                "type": "number"
              },
              "nextSteps": {
                "type": "string"
              }
            }
          },
          "userMessageContent": "={{$json.analysisPrompt}}",
          "systemMessageContent": "You are a lead classification AI. Analyze the lead information and classify it."
        },
        "options": {
          "model": {
            "modelName": "gpt-4",
            "temperature": 0.2
          }
        }
      },
      "typeVersion": 1.9
    },
    {
      "id": "slack-node",
      "name": "Send to Slack",
      "type": "n8n-nodes-base.slack",
      "position": [850, 300],
      "parameters": {
        "text": "New Lead: {{$json.leadName}} from {{$json.leadCompany}}\nClassification: {{$json.output.category}} ({{$json.output.confidence}}%)\nRecommended Next Steps: {{$json.output.nextSteps}}",
        "channel": "leads",
        "options": {}
      },
      "typeVersion": 1
    },
    {
      "id": "respond-node",
      "name": "HTTP Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "position": [1050, 300],
      "parameters": {
        "options": {},
        "respondWith": "json",
        "responseBody": "={ \"success\": true, \"classification\": \"{{$json.output.category}}\" }"
      },
      "typeVersion": 1
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Format Lead Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Format Lead Data": {
      "main": [
        [
          {
            "node": "Classify Lead",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Classify Lead": {
      "main": [
        [
          {
            "node": "Send to Slack",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Send to Slack": {
      "main": [
        [
          {
            "node": "HTTP Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
};

// Create the workflow
const result = create_workflow(workflowData);
console.log("Workflow created with ID:", result.id);

// Activate the workflow
activate_workflow({
  "workflowId": result.id
});
```

### Best Practices

1. **Use Meaningful IDs and Names**: Choose descriptive names that reflect node purpose
2. **Verify Node Types and Versions**: Check against n8n documentation
3. **Test Incrementally**: Build workflows step by step, testing after each addition
4. **Handle Errors**: Include error handling paths in your workflow
5. **Organize Node Positions**: Use consistent spacing on the canvas (x, y coordinates)
6. **Document Complex Workflows**: Add comments explaining workflow purpose and logic
7. **Version Control**: Keep track of previous working versions

Remember: The n8n API expects properly formatted JSON structures. Always verify your structure is correct before creating or updating workflows.
```
