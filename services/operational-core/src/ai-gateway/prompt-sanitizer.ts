// Pure, DB-free prompt sanitization — the first thing every AiGatewayService
// call does, before anything reaches the DGX boundary. See
// docs/architecture/security-dgx.md.
//
// Control characters and length are hard-enforced (stripped/truncated,
// always). Injection-pattern detection is flag-only, not blocking: a
// technician's genuine note ("ignore the warning light, customer says it's
// always on") would otherwise be a false-positive rejection. Flags are
// logged on the AiInferenceLog for review, same MANUAL_REVIEW-style
// philosophy as Phase 2/3 data quality — visible, not silently blocking.
const MAX_PROMPT_CHARS = 8_000;

// Built via the RegExp(string) constructor, with \\x escapes kept as plain
// text, rather than a /.../ literal containing raw control bytes. The whole
// point of this pattern is matching control characters, so the lint rule is
// deliberately overridden here rather than worked around.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', 'g');

const INJECTION_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'ignore_previous_instructions', pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i },
  { label: 'role_override', pattern: /you\s+are\s+now\s+(a|an)\b/i },
  { label: 'reveal_system_prompt', pattern: /(reveal|print|show)\s+(the\s+)?(system\s+prompt|your\s+instructions)/i },
  { label: 'act_as_developer_mode', pattern: /developer\s+mode|jailbreak/i },
];

export interface SanitizedPrompt {
  sanitized: string;
  truncated: boolean;
  injectionRiskFlags: string[];
}

export function sanitizePrompt(input: string): SanitizedPrompt {
  const stripped = input.replace(CONTROL_CHAR_PATTERN, '');
  const truncated = stripped.length > MAX_PROMPT_CHARS;
  const sanitized = truncated ? stripped.slice(0, MAX_PROMPT_CHARS) : stripped;

  const injectionRiskFlags = INJECTION_PATTERNS.filter((p) => p.pattern.test(sanitized)).map((p) => p.label);

  return { sanitized, truncated, injectionRiskFlags };
}
