// DGX Prototype 1.7 — document-ingestion prompt-injection defense (spec §38).
//
// A materially different threat model from src/ai-gateway/prompt-sanitizer.ts
// (short, single-utterance, human-authored CHAT prompts, flag-only) and
// src/catalogue-ai/rag/query-understanding.ts's PROMPT_INJECTION_PATTERNS
// (hard-refusal classifier gate for live queries). Ingested DOCUMENTS are
// multi-page, the injection text can be buried anywhere, and a genuine
// technical bulletin should NEVER contain these phrases at all — so this
// scanner takes a stricter block/quarantine posture and reports WHERE the
// flagged text occurred (not just a boolean), rather than flag-only.
//
// Known, honest limitation: this is regex-based, the same shape as
// PROMPT_INJECTION_PATTERNS — real gaps exist against phrasings outside
// this fixed pattern list. See docs/knowledge-platform/security-document-injection.md.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', 'g');

interface InjectionPattern {
  label: string;
  pattern: RegExp;
}

const DOCUMENT_INJECTION_PATTERNS: InjectionPattern[] = [
  { label: 'ignore_previous_instructions', pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i },
  { label: 'reveal_system_prompt', pattern: /(reveal|print|show)\s+(the\s+)?(system\s+prompt|your\s+instructions)/i },
  { label: 'execute_command', pattern: /execute\s+(sql|a\s+query|code|this\s+command)/i },
  { label: 'query_database', pattern: /(drop|delete|update|insert)\s+(table|from|into)\b/i },
  { label: 'change_system_behaviour', pattern: /change\s+(the\s+)?system('s)?\s+behaviou?r/i },
  { label: 'call_external_url', pattern: /https?:\/\/\S+\s+(and\s+)?(send|post|submit|report)/i },
  { label: 'override_policy', pattern: /override\s+(the\s+)?(policy|conflict|warning|restriction)/i },
  { label: 'modify_knowledge', pattern: /modify\s+(the\s+)?knowledge\s+(base|item|record)/i },
  { label: 'auto_approve_this_document', pattern: /approve\s+this\s+(document|item|version)\s+automatically/i },
  { label: 'mark_as_verified', pattern: /mark\s+(this|the)\s+.*\s+as\s+(verified|approved|reviewed)\b/i },
];

export interface InjectionFinding {
  label: string;
  matchedText: string;
  offset: number;
}

export interface DocumentScanResult {
  sanitizedText: string;
  findings: InjectionFinding[];
  quarantined: boolean;
}

// Real, per-document scan — control-char stripping is always applied
// (reused concept from prompt-sanitizer.ts's hard-enforced cleaning);
// injection-pattern detection reports every match's exact offset (unlike
// the chat sanitizer, which only flags a label). Any match => quarantined:
// true, a hard block, since legitimate technical content should never
// contain these phrases.
export function scanDocumentForInjection(rawText: string): DocumentScanResult {
  const sanitizedText = rawText.replace(CONTROL_CHAR_PATTERN, '');
  const findings: InjectionFinding[] = [];

  for (const { label, pattern } of DOCUMENT_INJECTION_PATTERNS) {
    const match = sanitizedText.match(pattern);
    if (match && match.index !== undefined) {
      findings.push({ label, matchedText: match[0], offset: match.index });
    }
  }

  return { sanitizedText, findings, quarantined: findings.length > 0 };
}
