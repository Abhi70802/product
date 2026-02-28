#!/usr/bin/env node
const fs = require('fs');

const DECISIONS = {
  AUTO_CLOSE: 'AUTO_CLOSE',
  ANALYST_REVIEW: 'ANALYST_REVIEW',
  ESCALATE: 'ESCALATE',
};

const REASON_CODE = {
  VELOCITY_PATTERN: 'VELOCITY_PATTERN',
  THRESHOLD_AVOIDANCE: 'THRESHOLD_AVOIDANCE',
  HIGH_RISK_CUSTOMER: 'HIGH_RISK_CUSTOMER',
  MEDIUM_RISK_CUSTOMER: 'MEDIUM_RISK_CUSTOMER',
  KYC_GAP: 'KYC_GAP',
  NEW_ACCOUNT: 'NEW_ACCOUNT',
  MATURE_ACCOUNT: 'MATURE_ACCOUNT',
  RULE_TRIGGER_DENSITY: 'RULE_TRIGGER_DENSITY',
  ALERT_HIGH_VELOCITY: 'ALERT_HIGH_VELOCITY',
  MISSING_TRANSACTION_TIMESTAMPS: 'MISSING_TRANSACTION_TIMESTAMPS',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreAlert(payload) {
  const profile = payload.customer_profile || {};
  const alert = payload.alert || {};
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];

  const scoreBreakdown = [];
  const reasonCodes = new Set();
  let score = 20; // base risk floor so empty alerts are not auto-zero
  scoreBreakdown.push({ signal: 'BASELINE', points: 20, why: 'All generated alerts start with non-zero base risk.' });

  if (transactions.length >= 3) {
    score += 30;
    reasonCodes.add(REASON_CODE.VELOCITY_PATTERN);
    scoreBreakdown.push({
      signal: 'MULTIPLE_TRANSACTIONS_SHORT_WINDOW',
      points: 30,
      why: 'Three or more transactions in the alert packet suggest velocity behavior.',
    });
  }

  const nearThresholdTxns = transactions.filter(
    (t) => Number(t.amount) >= 90000 && Number(t.amount) < 100000
  );
  if (nearThresholdTxns.length >= 2) {
    score += 20;
    reasonCodes.add(REASON_CODE.THRESHOLD_AVOIDANCE);
    scoreBreakdown.push({
      signal: 'AMOUNTS_NEAR_REGULATORY_THRESHOLD',
      points: 20,
      why: 'Repeated amounts close to 100,000 can indicate structuring/threshold avoidance.',
    });
  }

  const riskCategory = String(profile.risk_category || '').toLowerCase();
  if (riskCategory === 'high') {
    score += 20;
    reasonCodes.add(REASON_CODE.HIGH_RISK_CUSTOMER);
    scoreBreakdown.push({ signal: 'HIGH_RISK_CUSTOMER', points: 20, why: 'Higher inherent customer risk profile.' });
  } else if (riskCategory === 'medium') {
    score += 10;
    reasonCodes.add(REASON_CODE.MEDIUM_RISK_CUSTOMER);
    scoreBreakdown.push({ signal: 'MEDIUM_RISK_CUSTOMER', points: 10, why: 'Moderate inherent customer risk profile.' });
  }

  const kycStatus = String(profile.kyc_status || '').toLowerCase();
  if (kycStatus !== 'completed') {
    score += 25;
    reasonCodes.add(REASON_CODE.KYC_GAP);
    scoreBreakdown.push({ signal: 'KYC_NOT_COMPLETED', points: 25, why: 'Missing/incomplete KYC raises risk materially.' });
  }

  const accountAge = Number(profile.account_age_months);
  if (Number.isFinite(accountAge) && accountAge > 12) {
    score -= 15;
    reasonCodes.add(REASON_CODE.MATURE_ACCOUNT);
    scoreBreakdown.push({ signal: 'ACCOUNT_AGE_ABOVE_12M', points: -15, why: 'Long-standing account lowers baseline risk.' });
  } else if (Number.isFinite(accountAge) && accountAge < 3) {
    score += 15;
    reasonCodes.add(REASON_CODE.NEW_ACCOUNT);
    scoreBreakdown.push({ signal: 'VERY_NEW_ACCOUNT', points: 15, why: 'Very new account has limited behavior history.' });
  }

  const rules = Array.isArray(alert.triggered_rules) ? alert.triggered_rules : [];
  if (rules.length >= 3) {
    score += 10;
    reasonCodes.add(REASON_CODE.RULE_TRIGGER_DENSITY);
    scoreBreakdown.push({ signal: 'MANY_RULES_TRIGGERED', points: 10, why: 'Multiple rule hits increase concern.' });
  }

  if (String(alert.alert_type || '').toLowerCase().includes('high velocity')) {
    score += 15;
    reasonCodes.add(REASON_CODE.ALERT_HIGH_VELOCITY);
    scoreBreakdown.push({ signal: 'ALERT_TYPE_HIGH_VELOCITY', points: 15, why: 'Alert category itself implies unusual throughput.' });
  }

  const finalScore = clamp(score, 0, 100);

  return {
    riskScore: finalScore,
    reasonCodes: [...reasonCodes],
    scoreBreakdown,
  };
}

function llmReasoningLayer(payload, deterministic) {
  const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
  const hasTimestamps = transactions.every((t) => Boolean(t.timestamp));

  const findings = [];
  if (deterministic.reasonCodes.includes(REASON_CODE.VELOCITY_PATTERN)) {
    findings.push('Pattern suggests transaction velocity abuse (many transactions in one alert context).');
  }
  if (deterministic.reasonCodes.includes(REASON_CODE.THRESHOLD_AVOIDANCE)) {
    findings.push('Amounts cluster near threshold, consistent with possible structuring behavior.');
  }
  if (!hasTimestamps) {
    findings.push('Cannot fully validate short-window behavior because transaction timestamps are missing.');
  }

  const severeSignals = deterministic.reasonCodes.filter((code) =>
    [
      REASON_CODE.VELOCITY_PATTERN,
      REASON_CODE.THRESHOLD_AVOIDANCE,
      REASON_CODE.HIGH_RISK_CUSTOMER,
      REASON_CODE.KYC_GAP,
      REASON_CODE.ALERT_HIGH_VELOCITY,
    ].includes(code)
  ).length;

  const expectedMin = severeSignals * 12;
  const expectedMax = severeSignals * 24 + 20;
  const agrees = deterministic.riskScore >= expectedMin && deterministic.riskScore <= expectedMax;

  const uncertainties = [];
  if (!hasTimestamps) {
    uncertainties.push(REASON_CODE.MISSING_TRANSACTION_TIMESTAMPS);
  }
  if ((payload.alert?.triggered_rules || []).length === 0) {
    uncertainties.push('MISSING_TRIGGERED_RULES');
  }

  const confidence = clamp(0.55 + severeSignals * 0.08 - uncertainties.length * 0.07, 0.35, 0.95);

  return {
    llm_disagreement: !agrees,
    findings,
    uncertainties,
    confidence: Number(confidence.toFixed(2)),
  };
}

function finalDecision(riskScore, llmDisagreement) {
  let decision;
  if (riskScore >= 75) {
    decision = DECISIONS.ESCALATE;
  } else if (riskScore >= 35) {
    decision = DECISIONS.ANALYST_REVIEW;
  } else {
    decision = DECISIONS.AUTO_CLOSE;
  }

  if (decision === DECISIONS.AUTO_CLOSE && llmDisagreement) {
    decision = DECISIONS.ANALYST_REVIEW;
  }

  return decision;
}

function triage(payload) {
  const deterministic = scoreAlert(payload);
  const llm = llmReasoningLayer(payload, deterministic);
  const decision = finalDecision(deterministic.riskScore, llm.llm_disagreement);

  const explanation = [
    'Deterministic score computed from explicit weighted rules.',
    ...deterministic.scoreBreakdown.map((item) => `${item.signal}: ${item.points >= 0 ? '+' : ''}${item.points} (${item.why})`),
    `LLM reasoning ${llm.llm_disagreement ? 'challenged' : 'validated'} the numeric score.`,
    ...(llm.findings.length ? llm.findings : ['No additional behavioral pattern surfaced by LLM layer.']),
    ...(llm.uncertainties.length ? [`Uncertainties: ${llm.uncertainties.join(', ')}`] : []),
  ].join(' ');

  return {
    decision,
    risk_score: deterministic.riskScore,
    reason_codes: deterministic.reasonCodes,
    llm_disagreement: llm.llm_disagreement,
    explanation,
    confidence: llm.confidence,
    score_breakdown: deterministic.scoreBreakdown,
    llm_findings: llm.findings,
    llm_uncertainties: llm.uncertainties,
  };
}

function loadInput(pathArg) {
  if (!pathArg) {
    return {
      customer_profile: {
        risk_category: 'Medium',
        kyc_status: 'Completed',
        account_age_months: 14,
      },
      alert: {
        alert_type: 'High Velocity Transactions',
        triggered_rules: ['R-102', 'R-311'],
      },
      transactions: [
        { amount: 98000, type: 'credit', channel: 'UPI' },
        { amount: 97000, type: 'credit', channel: 'UPI' },
        { amount: 99000, type: 'credit', channel: 'UPI' },
      ],
    };
  }

  return JSON.parse(fs.readFileSync(pathArg, 'utf8'));
}

if (require.main === module) {
  const payload = loadInput(process.argv[2]);
  const result = triage(payload);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

module.exports = {
  triage,
  scoreAlert,
  llmReasoningLayer,
  finalDecision,
};
