# Authority Hierarchy

`KnowledgeSourceAuthority` — from most to least authoritative:

| Authority | Rank |
|---|---|
| `OEM_OFFICIAL` | 6 |
| `OEM_AUTHORIZED_DISTRIBUTOR` | 5 |
| `INDEPENDENT_TECHNICAL_PUBLISHER` | 4 |
| `INTERNAL_WORKSHOP` | 3 |
| `COMMUNITY_SOURCED` | 2 |
| `UNKNOWN` | 1 |

`AUTHORITY_RANK` (`src/knowledge-platform/retrieval/knowledge-retrieval.service.ts`) is the real, deterministic sort key `searchKnowledge()` uses to rank retrieved citations — never an LLM judgment. A caller may also set `maxAuthorityLevel` to hard-exclude anything above a given rank (e.g., a consumer that should only ever see internally-authored content).

Authority is inherited from the item's real `KnowledgeSource.authority` at creation time (`KnowledgeItemVersion.authorityLevel`) and carried through every subsequent version, including supersession — a corrected version keeps its source's real authority, it does not get to claim a higher one.
