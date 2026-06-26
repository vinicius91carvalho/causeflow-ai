import type { DataMaskingConfig, MaskingRuleType } from '../domain/data-masking.types.js';

const BUILTIN_PATTERNS: Record<MaskingRuleType, RegExp> = {
    ip_address: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    hostname: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi,
    aws_account_id: /\b\d{12}\b/g,
    aws_arn: /arn:aws[a-zA-Z-]*:[a-zA-Z0-9-]+:[a-z0-9-]*:\d{12}:[^\s,'"]+/g,
    database_connection_string: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s'"]+/gi,
    api_key: /\b(?:sk[-_]|pk[-_]|api[-_]?key[-_]?|token[-_]?)[a-zA-Z0-9_-]{16,}\b/gi,
    custom_regex: /(?!)/g, // never matches — replaced by custom pattern
};

const DEFAULT_REPLACEMENT = '***REDACTED***';

export class DataMasker {
    mask(text: string, config: DataMaskingConfig): string {
        if (!config.enabled || config.rules.length === 0) {
            return text;
        }

        let result = text;
        for (const rule of config.rules) {
            if (!rule.enabled) continue;

            const replacement = rule.replacement ?? DEFAULT_REPLACEMENT;
            let pattern: RegExp;

            if (rule.type === 'custom_regex' && rule.customPattern) {
                try {
                    pattern = new RegExp(rule.customPattern, 'g');
                } catch {
                    continue;
                }
            } else {
                pattern = BUILTIN_PATTERNS[rule.type];
            }

            result = result.replace(pattern, replacement);
        }

        return result;
    }
}
