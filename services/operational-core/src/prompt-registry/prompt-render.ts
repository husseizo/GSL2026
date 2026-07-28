// Pure template rendering — {{variableName}} substitution, nothing fancier.
// No conditionals, no loops: prompt templates are meant to be readable and
// auditable by a human reviewing the Prompt Registry, not a templating DSL.
export interface RenderResult {
  rendered: string;
  missingVariables: string[];
}

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderPromptTemplate(template: string, variables: Record<string, string>): RenderResult {
  const missing = new Set<string>();

  const rendered = template.replace(PLACEHOLDER_PATTERN, (_match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      return variables[name];
    }
    missing.add(name);
    return '';
  });

  return { rendered, missingVariables: [...missing] };
}
