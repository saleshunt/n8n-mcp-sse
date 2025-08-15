import { BaseWorkflowToolHandler } from './base-handler.js';
import { ToolCallResult, ToolDefinition, EdgeDefinition, WorkflowSettings } from '../../types/index.js';
import { N8nApiError } from '../../errors/index.js';
import { buildConnectionsFromEdges } from '../../builders/connections-builder.js';
import { validateNodesAndConnections, validateWorkflowShape } from '../../validation/workflow-validator.js';

export class ValidateWorkflowHandler extends BaseWorkflowToolHandler {
  async execute(args: Record<string, any>): Promise<ToolCallResult> {
    return this.handleExecution(async (args) => {
      const { name, nodes, connections, edges, settings } = (args || {}) as {
        name?: string;
        nodes?: any[];
        connections?: Record<string, any>;
        edges?: EdgeDefinition[];
        settings?: WorkflowSettings;
      };

      if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new N8nApiError('Validation requires a non-empty nodes array');
      }

      let finalConnections = connections as Record<string, any> | undefined;
      if (!finalConnections && Array.isArray(edges)) {
        finalConnections = buildConnectionsFromEdges(nodes, edges);
      }

      const finalSettings: WorkflowSettings = settings ?? {
        executionOrder: 'v1',
        timezone: 'UTC',
        saveExecutionProgress: true,
        saveManualExecutions: true,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        executionTimeout: 3600,
      };

      const workflowData: Record<string, any> = {
        name: name ?? 'ValidationOnly',
        nodes,
        connections: finalConnections ?? {},
        settings: finalSettings,
      };

      const shape = validateWorkflowShape(workflowData);
      const strong = validateNodesAndConnections(workflowData.nodes, workflowData.connections);

      const allErrors = [...shape.errors, ...strong.errors];
      if (allErrors.length > 0) {
        return this.formatError(
          `Validation failed with ${allErrors.length} issue(s):\n- ` +
            allErrors.map(e => e.message).join('\n- ')
        );
      }

      return this.formatSuccess({ valid: true }, 'Workflow is valid');
    }, args);
  }
}

export function getValidateWorkflowToolDefinition(): ToolDefinition {
  return {
    name: 'validate_workflow',
    description: 'Validate nodes + connections (or edges) without sending to n8n',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Optional workflow name for validation' },
        nodes: { type: 'array', description: 'Workflow nodes', items: { type: 'object' } },
        connections: { type: 'object', description: 'Connections object (optional if edges provided)' },
        edges: {
          type: 'array',
          description: 'Edges to build connections (optional)',
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
        settings: { type: 'object', description: 'Workflow settings (optional)' },
      },
      required: ['nodes'],
    },
  };
}


