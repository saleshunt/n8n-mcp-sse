export const nodeSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['id', 'name', 'type', 'position'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string' },
    typeVersion: { type: 'number' },
    position: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
    },
    parameters: { type: 'object' },
    credentials: { type: 'object' },
  },
};

export const workflowSettingsSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    saveExecutionProgress: { type: 'boolean' },
    saveManualExecutions: { type: 'boolean' },
    saveDataErrorExecution: { type: 'string', enum: ['all', 'none'] },
    saveDataSuccessExecution: { type: 'string', enum: ['all', 'none'] },
    executionTimeout: { type: 'number' },
    errorWorkflow: { type: 'string' },
    timezone: { type: 'string' },
    executionOrder: { type: 'string' },
  },
};

export const workflowSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['name', 'nodes', 'connections', 'settings'],
  properties: {
    name: { type: 'string' },
    nodes: { type: 'array', items: nodeSchema },
    connections: { type: 'object' },
    settings: workflowSettingsSchema,
  },
};


