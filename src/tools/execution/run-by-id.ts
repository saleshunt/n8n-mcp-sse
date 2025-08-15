import { BaseExecutionToolHandler } from './base-handler.js';
import { ToolCallResult, ToolDefinition } from '../../types/index.js';
import { N8nApiError } from '../../errors/index.js';

export class RunExecutionByIdHandler extends BaseExecutionToolHandler {
  async execute(args: Record<string, any>): Promise<ToolCallResult> {
    return this.handleExecution(async (args) => {
      const { workflowId, data, waitForCompletion } = (args || {}) as {
        workflowId?: string;
        data?: Record<string, any>;
        waitForCompletion?: boolean;
      };

      if (!workflowId) throw new N8nApiError('Missing required parameter: workflowId');

      // Trigger execution
      const exec = await this.apiService.executeWorkflow(workflowId, data || {});

      // If no wait requested, return the trigger response
      if (!waitForCompletion) {
        return this.formatSuccess(exec, 'Workflow execution started');
      }

      // If API returns an execution id, poll until finished
      const executionId = exec?.id || exec?.executionId || exec?.data?.id;
      if (!executionId) {
        return this.formatSuccess(exec, 'Started execution (no execution id returned to poll)');
      }

      // Simple polling loop (bounded)
      const maxAttempts = 30;
      const delayMs = 1000;
      let attempt = 0;
      /* eslint-disable no-await-in-loop */
      while (attempt < maxAttempts) {
        attempt++;
        try {
          const status = await this.apiService.getExecution(String(executionId));
          if (status?.finished === true || status?.status === 'success' || status?.status === 'error') {
            return this.formatSuccess(status, 'Workflow execution completed');
          }
        } catch {
          // ignore transient errors while polling
        }
        await new Promise(res => setTimeout(res, delayMs));
      }
      /* eslint-enable no-await-in-loop */
      return this.formatSuccess({ executionId }, 'Workflow execution still running (timeout reached)');
    }, args);
  }
}

export function getRunExecutionByIdToolDefinition(): ToolDefinition {
  return {
    name: 'execution_run',
    description: 'Execute a workflow by ID via API (optionally wait for completion)',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'ID of the workflow to execute' },
        data: { type: 'object', description: 'Optional input payload' },
        waitForCompletion: { type: 'boolean', description: 'Poll until finished', default: false },
      },
      required: ['workflowId'],
    },
  };
}


