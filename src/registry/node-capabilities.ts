/**
 * Node Capabilities Registry
 *
 * Defines allowed connection ports for known node types, so we can
 * validate connections beyond the default 'main' port.
 */

export interface NodePortCapabilities {
  // ports this node can OUTPUT on
  outputs: string[]; // e.g., ['main', 'ai_languageModel']
  // ports this node can ACCEPT as INPUTS
  inputs: string[]; // e.g., ['main', 'ai_languageModel']
}

/**
 * Minimal registry seeded with nodes from example workflows.
 * Extend over time as needed.
 */
export const NODE_CAPABILITIES: Record<string, NodePortCapabilities> = {
  // Default n8n nodes: assume only 'main' unless we know otherwise

  // LangChain agent node can accept special AI ports as inputs
  '@n8n/n8n-nodes-langchain.agent': {
    outputs: ['main'],
    inputs: ['main', 'ai_languageModel', 'ai_outputParser'],
  },

  // LLM chat model outputs a special port consumed by agent
  '@n8n/n8n-nodes-langchain.lmChatOpenAi': {
    outputs: ['ai_languageModel', 'main'],
    inputs: ['main'],
  },

  // Structured output parser outputs a special port consumed by agent
  '@n8n/n8n-nodes-langchain.outputParserStructured': {
    outputs: ['ai_outputParser', 'main'],
    inputs: ['main'],
  },
};

/**
 * Fallback capabilities when node type is unknown
 */
export const DEFAULT_CAPABILITIES: NodePortCapabilities = {
  outputs: ['main'],
  inputs: ['main'],
};

export function getNodeCapabilities(nodeType: string): NodePortCapabilities {
  return NODE_CAPABILITIES[nodeType] ?? DEFAULT_CAPABILITIES;
}


