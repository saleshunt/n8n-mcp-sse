// // console.error('[UPDATE_TS_LOADED_VERSION_MAY18_01]'); // Keep this commented for now
/**
 * Update Workflow Tool
 * 
 * This tool updates an existing workflow in n8n.
 */

import { BaseWorkflowToolHandler } from './base-handler.js';
import { ToolCallResult, ToolDefinition } from '../../types/index.js';
import { N8nApiError } from '../../errors/index.js';

/**
 * Handler for the update_workflow tool
 */
export class UpdateWorkflowHandler extends BaseWorkflowToolHandler {
  /**
   * Execute the tool
   * 
   * @param args Tool arguments containing workflow updates
   * @returns Updated workflow information
   */
  async execute(args: Record<string, any>): Promise<ToolCallResult> {
    // console.error('[UpdateWorkflowHandler] execute START. Raw args:', JSON.stringify(args, null, 2));
    return this.handleExecution(async (args) => {
      // console.error('[UpdateWorkflowHandler] handleExecution START. Parsed args:', JSON.stringify(args, null, 2));
      const { workflowId, name, nodes, connections } = args;
      
      if (!workflowId) {
        // console.error('[UpdateWorkflowHandler] Error: Missing workflowId.');
        throw new N8nApiError('Missing required parameter: workflowId');
      }
      
      // Validate nodes if provided
      if (nodes && !Array.isArray(nodes)) {
        // console.error('[UpdateWorkflowHandler] Error: Parameter "nodes" must be an array.');
        throw new N8nApiError('Parameter "nodes" must be an array');
      }
      
      // Validate connections if provided
      if (connections && typeof connections !== 'object') {
        // console.error('[UpdateWorkflowHandler] Error: Parameter "connections" must be an object.');
        throw new N8nApiError('Parameter "connections" must be an object');
      }
      
      // console.error(`[UpdateWorkflowHandler] Fetching current workflow for ID: ${workflowId}`);
      const currentWorkflow = await this.apiService.getWorkflow(workflowId);
      // console.error('[UpdateWorkflowHandler] Fetched currentWorkflow. Top-level keys:', Object.keys(currentWorkflow || {}));
      
      // REFINED: Construct a clean payload based on API requirements
      const workflowData: Record<string, any> = {
        // Required fields as per n8n API documentation for PUT /workflows/{id}
        name: name !== undefined ? name : currentWorkflow.name,
        nodes: nodes !== undefined ? nodes : currentWorkflow.nodes,
        connections: connections !== undefined ? connections : currentWorkflow.connections,
        settings: {}, // TEST: Send minimal empty settings object
      };
      
      // CRITICAL LOG: Keep this one active for now
      console.error('[UpdateWorkflowHandler] Constructed workflowData to send:', JSON.stringify(workflowData, null, 2));

      // staticData is optional in docs. OMITTING COMPLETELY FOR THIS TEST.
      // if (currentWorkflow.staticData !== undefined && currentWorkflow.staticData !== null) {
      //   workflowData.staticData = currentWorkflow.staticData;
      // }
      
      // DO NOT include 'active' or 'tags' in this payload for PUT /workflows/{id}
      // 'active' state is managed by POST /workflows/{id}/activate and POST /workflows/{id}/deactivate
      // 'tags' update mechanism via this general endpoint is not specified in the PUT schema.
      
      // console.error(`[UpdateWorkflowHandler] Calling apiService.updateWorkflow for ID: ${workflowId}`);
      try {
        const updatedWorkflow = await this.apiService.updateWorkflow(workflowId, workflowData);
        // console.error('[UpdateWorkflowHandler] apiService.updateWorkflow successful. Response:', JSON.stringify(updatedWorkflow, null, 2));
      
        // Build a summary of changes
        const changesArray = [];
        if (name !== undefined && name !== currentWorkflow.name) changesArray.push(`name: "${currentWorkflow.name}" → "${name}"`);
        if (nodes !== undefined) changesArray.push('nodes updated'); // Note: This is a simplistic summary for nodes/connections
        if (connections !== undefined) changesArray.push('connections updated');
        
        const changesSummary = changesArray.length > 0
          ? `Changes: ${changesArray.join(', ')}`
          : 'No changes to name, nodes, or connections were specified.';
        
        // console.error('[UpdateWorkflowHandler] Formatting success response.');
        return this.formatSuccess(
          {
            id: updatedWorkflow.id,
            name: updatedWorkflow.name,
            active: updatedWorkflow.active // 'active' in response is fine, just not in PUT request body for this endpoint
          },
          `Workflow updated successfully. ${changesSummary}`
        );
      } catch (error: any) {
        console.error('[UpdateWorkflowHandler] Error during apiService.updateWorkflow:', error.message, error.stack);
        if (error.response && error.response.data) {
          console.error('[UpdateWorkflowHandler] Error response data:', JSON.stringify(error.response.data, null, 2));
        }
        throw error; // Re-throw the error to be handled by handleExecution
      }
    }, args);
  }
}

/**
 * Get tool definition for the update_workflow tool
 * 
 * @returns Tool definition
 */
export function getUpdateWorkflowToolDefinition(): ToolDefinition {
  return {
    name: 'update_workflow',
    description: 'Update an existing workflow in n8n',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'ID of the workflow to update',
        },
        name: {
          type: 'string',
          description: 'New name for the workflow',
        },
        nodes: {
          type: 'array',
          description: 'Updated array of node objects that define the workflow',
          items: {
            type: 'object',
          },
        },
        connections: {
          type: 'object',
          description: 'Updated connection mappings between nodes',
        },
      },
      required: ['workflowId'],
    },
  };
}
