/**
 * Expression utilities for n8n templates
 */

const NODE_REF_REGEX = /\$\(\s*['"]([^'"]+)['"]\s*\)/g; // Matches $('Node Name')

export function isExpression(value: unknown): boolean {
  return typeof value === 'string' && value.trim().startsWith('={{') && value.trim().endsWith('}}');
}

export function normalizeExpression(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('={{') && trimmed.endsWith('}}')) return value;
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) return `=${trimmed}`;
  if (trimmed.startsWith('=')) return value;
  return `=${value}`;
}

export function findNodeRefsInString(text: string): string[] {
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = NODE_REF_REGEX.exec(text)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

export function deepFindNodeRefs(obj: any): string[] {
  const results: string[] = [];
  const visit = (val: any) => {
    if (typeof val === 'string') {
      results.push(...findNodeRefsInString(val));
      return;
    }
    if (Array.isArray(val)) {
      val.forEach(visit);
      return;
    }
    if (val && typeof val === 'object') {
      Object.values(val).forEach(visit);
    }
  };
  visit(obj);
  return Array.from(new Set(results));
}


