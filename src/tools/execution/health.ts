import { BaseExecutionToolHandler } from './base-handler.js';
import { ToolCallResult, ToolDefinition } from '../../types/index.js';
import { getEnvConfig } from '../../config/environment.js';

export class HealthCheckHandler extends BaseExecutionToolHandler {
  async execute(args: Record<string, any>): Promise<ToolCallResult> {
    return this.handleExecution(async () => {
      // Validate env and connectivity
      const env = getEnvConfig();
      await this.apiService.checkConnectivity();

      const result = {
        apiUrl: env.n8nApiUrl,
        webhookAuthConfigured: Boolean(env.n8nWebhookUsername && env.n8nWebhookPassword),
        debug: env.debug,
        status: 'ok'
      };
      return this.formatSuccess(result, 'MCP ↔ n8n health: OK');
    }, args);
  }
}

export function getHealthCheckToolDefinition(): ToolDefinition {
  return {
    name: 'health_check',
    description: 'Verify environment and n8n API connectivity',
    inputSchema: { type: 'object', properties: {}, required: [] },
  };
}


