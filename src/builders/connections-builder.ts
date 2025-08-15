import { Connections, EdgeDefinition, NodeConnections, PortConnections } from '../types/index.js';
import { getNodeCapabilities } from '../registry/node-capabilities.js';

function ensurePort(connections: NodeConnections, port: string): PortConnections {
  if (!connections[port]) connections[port] = [];
  return connections[port];
}

export function buildConnectionsFromEdges(
  nodes: { name: string; type?: string }[],
  edges: EdgeDefinition[]
): Connections {
  const connections: Connections = {};
  const nameToType = new Map<string, string>();

  nodes.forEach(n => nameToType.set(n.name, n.type ?? ''));

  for (const edge of edges) {
    const from = edge.from;
    const to = edge.to;
    const fromPort = edge.fromPort ?? 'main';
    const toPort = edge.toPort ?? fromPort;
    const fromIndex = edge.fromIndex ?? 0;
    const toIndex = edge.toIndex ?? 0;

    if (!nameToType.has(from)) throw new Error(`Edge refers to unknown source node: ${from}`);
    if (!nameToType.has(to)) throw new Error(`Edge refers to unknown target node: ${to}`);

    // Validate ports using capabilities
    const fromType = nameToType.get(from) as string;
    const toType = nameToType.get(to) as string;
    const fromCaps = getNodeCapabilities(fromType);
    const toCaps = getNodeCapabilities(toType);
    if (!fromCaps.outputs.includes(fromPort)) {
      throw new Error(`Node "${from}" (type ${fromType}) does not support output port "${fromPort}"`);
    }
    if (!toCaps.inputs.includes(toPort)) {
      throw new Error(`Node "${to}" (type ${toType}) does not support input port "${toPort}"`);
    }

    if (!connections[from]) connections[from] = {};
    const ports = connections[from];
    const portConn = ensurePort(ports, fromPort);
    // Ensure array for output index
    if (!portConn[fromIndex]) portConn[fromIndex] = [];
    portConn[fromIndex].push({ node: to, type: toPort, index: toIndex });
  }

  return connections;
}


