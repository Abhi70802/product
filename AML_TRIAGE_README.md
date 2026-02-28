# AI-assisted AML Alert Triage (Node.js)

## What this implementation covers

This solution implements all required parts:

1. **Deterministic risk logic (0-100)**
   - Explicit weighted rules produce a numeric `risk_score`.
   - The system returns a machine-readable `score_breakdown` showing each signal, points, and justification.
2. **LLM reasoning layer (mandatory behavior reasoning)**
   - `llmReasoningLayer` validates/challenges the deterministic score.
   - It identifies behavioral patterns (velocity, threshold avoidance).
   - It surfaces uncertainty (e.g., missing timestamps).
3. **Decision logic with hard rule**
   - Outputs one of: `AUTO_CLOSE`, `ANALYST_REVIEW`, `ESCALATE`.
   - `AUTO_CLOSE` is only allowed when score is below threshold **and** no LLM disagreement.

## Files

- `aml-triage.js` — main Node.js implementation (CLI + reusable functions).
- `sample-input.json` — sample scenario from prompt context.
- `sample-input-low-risk.json` — low-risk sample to validate `AUTO_CLOSE` path.

## Run

```bash
node aml-triage.js sample-input.json
node aml-triage.js sample-input-low-risk.json
```

If no input file is provided, `aml-triage.js` uses the prompt sample as default.

## Output format

The script returns JSON with required fields:

```json
{
  "decision": "ANALYST_REVIEW",
  "risk_score": 80,
  "reason_codes": ["..."],
  "llm_disagreement": false,
  "explanation": "...",
  "confidence": 0.78
}
```

Plus traceability fields:
- `score_breakdown`
- `llm_findings`
- `llm_uncertainties`

## Requirement review checklist

- [x] Ingests alert + transaction data
- [x] Applies deterministic scoring with explicit points
- [x] Provides explanation of why each signal exists
- [x] Adds reasoning layer that validates/challenges score
- [x] Surfaces uncertainty/missing signals
- [x] Produces exactly one final decision class
- [x] Enforces hard rule on `AUTO_CLOSE`
- [x] Includes sample inputs and outputs via CLI runs

