/**
 * n8n API Client Interface
 * 
 * This module defines interfaces and types for the n8n API client.
 */

import { N8nApiClient } from './client.js';
import { EnvConfig } from '../config/environment.js';
import { Workflow, Execution } from '../types/index.js';

/**
 * n8n API service - provides functions for interacting with n8n API
 */
export class N8nApiService {
  private client: N8nApiClient;

  /**
   * Create a new n8n API service
   * 
   * @param config Environment configuration
   */
  constructor(config: EnvConfig) {
    // console.error('[N8nApiService] Initializing with base URL:', config.n8nApiUrl, 'Debug mode:', config.debug);
    this.client = new N8nApiClient(config);
  }

  /**
   * Check connectivity to the n8n API
   */
  async checkConnectivity(): Promise<void> {
    return this.client.checkConnectivity();
  }

  /**
   * Get all workflows from n8n
   * 
   * @returns Array of workflow objects
   */
  async getWorkflows(): Promise<Workflow[]> {
    return this.client.getWorkflows();
  }

  /**
   * Get a specific workflow by ID
   * 
   * @param id Workflow ID
   * @returns Workflow object
   */
  async getWorkflow(id: string): Promise<Workflow> {
    // console.error(`[N8nApiService] getWorkflow START. ID: ${id}`);
    try {
      const workflow = await this.client.getWorkflow(id);
      // console.error(`[N8nApiService] getWorkflow SUCCESS. ID: ${id}. Top-level keys of result:`, Object.keys(workflow || {}));
      return workflow;
    } catch (error: any) {
      // console.error(`[N8nApiService] getWorkflow ERROR. ID: ${id}:`, error.message, error.stack);
      throw error;
    }
  }

  /**
   * Execute a workflow by ID
   * 
   * @param id Workflow ID
   * @param data Optional data to pass to the workflow
   * @returns Execution result
   */
  async executeWorkflow(id: string, data?: Record<string, any>): Promise<any> {
    return this.client.executeWorkflow(id, data);
  }

  /**
   * Create a new workflow
   * 
   * @param workflow Workflow object to create
   * @returns Created workflow
   */
  async createWorkflow(workflow: Record<string, any>): Promise<Workflow> {
    return this.client.createWorkflow(workflow);
  }

  /**
   * Update an existing workflow
   * 
   * @param id Workflow ID
   * @param workflow Updated workflow object
   * @returns Updated workflow
   */
  async updateWorkflow(id: string, workflow: Record<string, any>): Promise<Workflow> {
    // console.error(`[N8nApiService] updateWorkflow START. ID: ${id}. Payload to send:`, JSON.stringify(workflow, null, 2));
    try {
      const updatedWorkflow = await this.client.updateWorkflow(id, workflow);
      // console.error(`[N8nApiService] updateWorkflow SUCCESS. ID: ${id}. Response:`, JSON.stringify(updatedWorkflow, null, 2));
      return updatedWorkflow;
    } catch (error: any) {
      // console.error(`[N8nApiService] updateWorkflow ERROR. ID: ${id}:`, error.message, error.stack);
      // if (error.response && error.response.data) {
      //  console.error('[N8nApiService] updateWorkflow ERROR response data:', JSON.stringify(error.response.data, null, 2));
      // }
      throw error;
    }
  }

  /**
   * Delete a workflow
   * 
   * @param id Workflow ID
   * @returns Deleted workflow or success message
   */
  async deleteWorkflow(id: string): Promise<any> {
    return this.client.deleteWorkflow(id);
  }

  /**
   * Activate a workflow
   * 
   * @param id Workflow ID
   * @returns Activated workflow
   */
  async activateWorkflow(id: string): Promise<Workflow> {
    return this.client.activateWorkflow(id);
  }

  /**
   * Deactivate a workflow
   * 
   * @param id Workflow ID
   * @returns Deactivated workflow
   */
  async deactivateWorkflow(id: string): Promise<Workflow> {
    return this.client.deactivateWorkflow(id);
  }

  /**
   * Get all workflow executions
   * 
   * @returns Array of execution objects
   */
  async getExecutions(): Promise<Execution[]> {
    return this.client.getExecutions();
  }

  /**
   * Get a specific execution by ID
   * 
   * @param id Execution ID
   * @returns Execution object
   */
  async getExecution(id: string): Promise<Execution> {
    return this.client.getExecution(id);
  }
  
  /**
   * Delete an execution
   * 
   * @param id Execution ID
   * @returns Deleted execution or success message
   */
  async deleteExecution(id: string): Promise<any> {
    return this.client.deleteExecution(id);
  }
}

/**
 * Create a new n8n API service
 * 
 * @param config Environment configuration
 * @returns n8n API service
 */
export function createApiService(config: EnvConfig): N8nApiService {
  return new N8nApiService(config);
}
