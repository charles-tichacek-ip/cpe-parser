export interface ParsedCPE {
  provider: string;
  course_title: string;
  completion_date: string;       // ISO date string or ""
  credit_hours: number | null;
  delivery_method: string;
  designations: string[];        // ["CIA","CISA",...]
  categories: Record<string, string>; // { CIA: "Ethics", CISA: "IS Audit" }
  is_verifiable: boolean;
  notes: string;
  confidence: number;            // 0–1
  low_conf_fields: string[];
}

const SYSTEM_PROMPT = `You are a CPE (Continuing Professional Education) certificate parser for professional accounting and audit designations.

Extract structured data from CPE certificates, completion emails, or course descriptions.

Return ONLY valid JSON matching this exact shape — no markdown, no preamble:
{
  "provider": "string — organization that issued the CPE",
  "course_title": "string — full course or activity name",
  "completion_date": "string — ISO 8601 (YYYY-MM-DD) or empty string if unknown",
  "credit_hours": number or null,
  "delivery_method": "one of: Live Webinar, On-Demand / Self-Study, In-Person, Conference, University Course, Other",
  "designations": ["array of applicable designations from: CIA, CISA, CPA, CITP, BABL"],
  "categories": {
    "CIA": "category string if CIA applies, else omit key",
    "CISA": "category string if CISA applies, else omit key",
    "CPA": "category string if CPA applies, else omit key",
    "CITP": "category string if CITP applies, else omit key"
  },
  "is_verifiable": true or false,
  "notes": "string — any caveats, prerequisites, or relevant context",
  "confidence": number 0–1,
  "low_conf_fields": ["array of field names you were uncertain about"]
}

DESIGNATION RULES — INCLUDE BROADLY:
Default to including CIA, CISA, CPA, and CITP unless the content is clearly irrelevant to a designation. Most professional development, leadership, ethics, technology, audit, finance, and business content qualifies for all four. Err on the side of inclusion — the reviewer will remove designations that don't apply.

Only exclude a designation if the content is unambiguously outside its scope:
- Exclude CIA only if content has zero relevance to audit, risk, governance, or internal controls
- Exclude CISA only if content has zero relevance to IT, systems, data, or information security
- Exclude CPA only if content has zero relevance to business, finance, accounting, or professional competency
- Exclude CITP only if content has zero relevance to technology, data, or digital topics

CATEGORIES — BE SPECIFIC AND STRICT:
For each included designation, assign the most specific category:
- CIA: "Technical" | "Ethics" | "Other"
- CISA: "IS Audit Process" | "IT Governance" | "Systems Acquisition" | "IT Operations" | "Protection of Information Assets"
- CPA: "Verifiable" | "Ethics" | "Other"
- CITP: "Technical" | "Management" | "Other"

Only mark a category as "Ethics" if the course is explicitly about professional ethics — not just governance or conduct.

VERIFIABILITY (CPA Ontario) — BE STRICT:
- is_verifiable = true ONLY if there is an explicit certificate of completion, attendance confirmation, or formal assessment from a recognized provider
- is_verifiable = false for: self-study without exam, informal learning, on-the-job activities, reading, internal training without documentation

CONFIDENCE:
- 0.9+: clear certificate with all fields explicit
- 0.7–0.9: most fields clear, minor inference required
- Below 0.7: significant fields missing or ambiguous — populate low_conf_fields`;

export async function parseCPEText(text: string): Promise<ParsedCPE> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Parse this CPE document:\n\n${text}` }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json() as any;
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as ParsedCPE;
  } catch {
    throw new Error('Failed to parse Claude response as JSON');
  }
}
