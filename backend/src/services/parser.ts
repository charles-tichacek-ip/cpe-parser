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

DESIGNATION RULES:
- CIA (IIA): Internal audit, risk management, control environment, governance, ethics, fraud
- CISA (ISACA): IS audit process, IT governance, systems acquisition/development/implementation, IT operations, protection of information assets, cybersecurity
- CPA (Ontario): Accounting, financial reporting, tax, assurance, finance, business law, ethics, management — content must be relevant to CPA competencies
- CITP: Information technology, data management, cybersecurity, emerging tech, digital transformation
- A single course can and often should map to multiple designations — e.g. IT audit maps to both CISA and CIA
- Ethics courses apply to all held designations

VERIFIABILITY (CPA Ontario):
- is_verifiable = true: has certificate, attendance record, or completion confirmation from provider
- is_verifiable = false: on-the-job training, self-study without exam, casual reading

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
