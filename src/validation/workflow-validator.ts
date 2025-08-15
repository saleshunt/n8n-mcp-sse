import Ajv, { type ErrorObject } from 'ajv';
import { Connections, N8nNode } from '../types/index.js';
import { workflowSchema } from './workflow-schema.js';
import { getNodeCapabilities } from '../registry/node-capabilities.js';
import { deepFindNodeRefs } from '../utils/expressions.js';

const ajv = new Ajv.default({ allErrors: true, allowUnionTypes: true } as any);
const validateWorkflowSchema = ajv.compile(workflowSchema as any);

export interface ValidationIssue {
  path?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

export function validateWorkflowShape(workflow: Record<string, any>): ValidationResult {
  const ok = validateWorkflowSchema(workflow);
  if (ok) return { valid: true, errors: [] };
  const errors = (validateWorkflowSchema.errors || []).map((e: ErrorObject) => ({
    path: e.instancePath || e.schemaPath,
    message: e.message || 'Invalid',
  }));
  return { valid: false, errors };
}

export function validateNodesAndConnections(nodes: N8nNode[], connections: Connections): ValidationResult {
  const errors: ValidationIssue[] = [];

  // Unique node names & ids
  const nameSet = new Set<string>();
  const idSet = new Set<string>();
  for (const n of nodes) {
    if (!n.name) errors.push({ message: 'Node missing name' });
    if (!n.id) errors.push({ message: `Node "${n.name}" missing id` });
    if (nameSet.has(n.name)) errors.push({ message: `Duplicate node name: ${n.name}` });
    if (idSet.has(n.id)) errors.push({ message: `Duplicate node id: ${n.id}` });
    nameSet.add(n.name);
    idSet.add(n.id);
    if (!Array.isArray(n.position) || n.position.length !== 2) {
      errors.push({ message: `Node "${n.name}" has invalid position` });
    }
  }

  // Validate connections structure
  for (const [sourceName, ports] of Object.entries(connections || {})) {
    if (!nameSet.has(sourceName)) {
      errors.push({ message: `Connections reference unknown source node: ${sourceName}` });
      continue;
    }
    const sourceNode = nodes.find(n => n.name === sourceName)!;
    const caps = getNodeCapabilities(sourceNode.type);

    for (const [portName, portConnections] of Object.entries(ports)) {
      if (!caps.outputs.includes(portName)) {
        errors.push({ message: `Node "${sourceName}" (type ${sourceNode.type}) cannot output on port "${portName}"` });
      }
      if (!Array.isArray(portConnections)) {
        errors.push({ message: `Port "${sourceName}.${portName}" must be an array per output index` });
        continue;
      }
      portConnections.forEach((targets, index) => {
        if (!Array.isArray(targets)) {
          errors.push({ message: `Port "${sourceName}.${portName}[${index}]" must be an array of targets` });
          return;
        }
        targets.forEach((t, ti) => {
          if (!t || typeof t !== 'object') {
            errors.push({ message: `Invalid target at ${sourceName}.${portName}[${index}][${ti}]` });
            return;
          }
          if (!nameSet.has(t.node)) {
            errors.push({ message: `Target node not found: ${t.node} (from ${sourceName}.${portName})` });
          }
          const targetNode = nodes.find(n => n.name === t.node);
          if (targetNode) {
            const targetCaps = getNodeCapabilities(targetNode.type);
            if (!targetCaps.inputs.includes(t.type)) {
              errors.push({ message: `Target node "${t.node}" (type ${targetNode.type}) does not accept input port "${t.type}"` });
            }
          }
          if (typeof t.index !== 'number') {
            errors.push({ message: `Target index must be number at ${sourceName}.${portName}[${index}] → ${t.node}` });
          }
        });
      });
    }
  }

  // Expression cross-checks
  for (const n of nodes) {
    const refs = n.parameters ? deepFindNodeRefs(n.parameters) : [];
    for (const ref of refs) {
      if (!nameSet.has(ref)) {
        errors.push({ message: `Node "${n.name}" has expression reference to unknown node "${ref}"` });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}


