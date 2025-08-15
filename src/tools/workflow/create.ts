/**
 * Create Workflow Tool
 * 
 * This tool creates a new workflow in n8n.
 */

import { BaseWorkflowToolHandler } from './base-handler.js';
import { ToolCallResult, ToolDefinition, EdgeDefinition, WorkflowSettings } from '../../types/index.js';
import { N8nApiError } from '../../errors/index.js';
import { buildConnectionsFromEdges } from '../../builders/connections-builder.js';
import { validateNodesAndConnections, validateWorkflowShape } from '../../validation/workflow-validator.js';

/**
 * Handler for the create_workflow tool
 */
export class CreateWorkflowHandler extends BaseWorkflowToolHandler {
  /**
   * Execute the tool
   * 
   * @param args Tool arguments containing workflow details
   * @returns Created workflow information
   */
  async execute(args: Record<string, any>): Promise<ToolCallResult> {
    return this.handleExecution(async (args) => {
      const { name, nodes, connections, edges, active, tags, settings } = args as {
        name: string;
        nodes?: any[];
        connections?: Record<string, any>;
        edges?: EdgeDefinition[];
        active?: boolean;
        tags?: string[];
        settings?: WorkflowSettings;
      };
      
      if (!name) {
        throw new N8nApiError('Missing required parameter: name');
      }
      
      // Validate nodes if provided
      if (nodes && !Array.isArray(nodes)) {
        throw new N8nApiError('Parameter "nodes" must be an array');
      }
      
      // Validate connections if provided
      if (connections && typeof connections !== 'object') {
        throw new N8nApiError('Parameter "connections" must be an object');
      }

      // If edges are provided, build connections
      let finalConnections = connections as Record<string, any> | undefined;
      if (!finalConnections && Array.isArray(edges) && Array.isArray(nodes)) {
        finalConnections = buildConnectionsFromEdges(nodes, edges);
      }

      // Ensure settings
      const finalSettings: WorkflowSettings = settings ?? {
        saveExecutionProgress: true,
        saveManualExecutions: true,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        executionTimeout: 3600,
        timezone: 'UTC',
        executionOrder: 'v1',
      };
      
      // Prepare workflow object
      const workflowData: Record<string, any> = {
        name,
        active: active === true,  // Default to false if not specified
        settings: finalSettings,
      };
      
      // Add optional fields if provided
      if (nodes) workflowData.nodes = nodes;
      if (finalConnections) workflowData.connections = finalConnections;
      if (tags) workflowData.tags = tags;

      // Validate shape according to OpenAPI (requires nodes/connections/settings)
      const shapeResult = validateWorkflowShape(workflowData);
      if (!shapeResult.valid) {
        throw new N8nApiError(`Workflow schema validation failed: ${shapeResult.errors.map(e => e.message).join('; ')}`);
      }

      // Strong validation for nodes + connections
      const strongResult = validateNodesAndConnections(workflowData.nodes, workflowData.connections);
      if (!strongResult.valid) {
        throw new N8nApiError(`Workflow validation failed: ${strongResult.errors.map(e => e.message).join('; ')}`);
      }
      
      // Create the workflow
      const workflow = await this.apiService.createWorkflow(workflowData);
      
      return this.formatSuccess(
        {
          id: workflow.id,
          name: workflow.name,
          active: workflow.active
        },
        `Workflow created successfully`
      );
    }, args);
  }
}

/**
 * Get tool definition for the create_workflow tool
 * 
 * @returns Tool definition
 */
export function getCreateWorkflowToolDefinition(): ToolDefinition {
  return {
    name: 'create_workflow',
    description: 'Create a new workflow in n8n',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the workflow',
        },
        nodes: {
          type: 'array',
          description: 'Array of node objects that define the workflow',
          items: {
            type: 'object',
          },
        },
        connections: {
          type: 'object',
          description: 'Connection mappings between nodes (or provide edges and we will build this for you)',
        },
        edges: {
          type: 'array',
          description: 'Optional high-level edges to build connections',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              fromPort: { type: 'string' },
              toPort: { type: 'string' },
              fromIndex: { type: 'number' },
              toIndex: { type: 'number' },
            },
            required: ['from', 'to'],
          },
        },
        active: {
          type: 'boolean',
          description: 'Whether the workflow should be active upon creation',
        },
        settings: {
          type: 'object',
          description: 'Workflow settings; defaults are applied if omitted',
        },
        tags: {
          type: 'array',
          description: 'Tags to associate with the workflow',
          items: {
            type: 'string',
          },
        },
      },
      required: ['name'],
    },
  };
}
