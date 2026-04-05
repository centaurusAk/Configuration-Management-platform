export interface Context {
  user_id?: string;
  region?: string;
  app_version?: string;
  tier?: string;
  custom_attributes?: Record<string, any>;
}

export interface EvaluationTrace {
  rule_id: string;
  priority: number;
  matched: boolean;
  reason?: string;
}

export interface RuleTestResult {
  value: any;
  matched_rule: any | null;
  default_value: any;
  evaluation_trace: EvaluationTrace[];
}
