/**
 * Core Types Module
 * 
 * This module provides type definitions used throughout the application
 * and bridges compatibility with the MCP SDK.
 */

// Tool definition for MCP tools
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// Tool call result for MCP tool responses
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Strict n8n node type
 */
export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters?: Record<string, any>;
  credentials?: Record<string, { id: string; name: string }>;
  [key: string]: any;
}

/**
 * Workflow Settings as per OpenAPI schema
 */
export interface WorkflowSettings {
  saveExecutionProgress?: boolean;
  saveManualExecutions?: boolean;
  saveDataErrorExecution?: 'all' | 'none';
  saveDataSuccessExecution?: 'all' | 'none';
  executionTimeout?: number;
  errorWorkflow?: string;
  timezone?: string;
  executionOrder?: string;
  [key: string]: any;
}

/**
 * Connections structure as used by n8n
 */
export type ConnectionTarget = { node: string; type: string; index: number };
export type PortConnections = ConnectionTarget[][]; // array per output index
export type NodeConnections = Record<string, PortConnections>; // port name -> connections
export type Connections = Record<string, NodeConnections>; // source node name -> ports

/**
 * Optional high-level Edge DSL to build n8n connections
 */
export interface EdgeDefinition {
  from: string;
  to: string;
  fromPort?: string; // default: main
  toPort?: string;   // default: main
  fromIndex?: number; // default: 0
  toIndex?: number;   // default: 0
}

// Type for n8n workflow object
export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Connections;
  createdAt: string;
  updatedAt: string;
  settings?: WorkflowSettings;
  [key: string]: any;
}

// Type for n8n execution object
export interface Execution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt: string;
  status: string;
  data: {
    resultData: {
      runData: any;
    };
  };
  [key: string]: any;
}
