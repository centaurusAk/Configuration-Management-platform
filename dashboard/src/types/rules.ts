export type RuleOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'in_list' 
  | 'not_in_list' 
  | 'greater_than' 
  | 'less_than' 
  | 'regex_match';

export interface Condition {
  attribute: string;
  operator: RuleOperator;
  value: any;
}

export interface Rule {
  id: string;
  config_key_id: string;
  priority: number;
  conditions: Condition[];
  value: any;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleFormData {
  config_key_id: string;
  priority: number;
  conditions: Condition[];
  value: any;
  enabled: boolean;
}
