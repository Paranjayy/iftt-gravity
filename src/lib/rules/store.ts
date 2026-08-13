import { Rule, validateRule } from './types';

export class RuleStore {
  constructor(private config: any) {}

  list(): Rule[] {
    return (this.config.rules || []) as Rule[];
  }

  save(input: any): Rule {
    const rule = validateRule(input);
    const rules = this.config.rules || (this.config.rules = []);
    const idx = rules.findIndex((r: Rule) => r.id === rule.id);
    if (idx >= 0) rules[idx] = rule;
    else rules.push(rule);
    this.persist();
    return rule;
  }

  remove(id: string) {
    const rules = this.config.rules || [];
    this.config.rules = rules.filter((r: Rule) => r.id !== id);
    this.persist();
  }

  private persist() {
    if (typeof this.config.save === 'function') this.config.save();
  }
}
