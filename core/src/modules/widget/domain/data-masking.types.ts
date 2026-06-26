export type MaskingRuleType =
    | 'ip_address'
    | 'email'
    | 'hostname'
    | 'aws_account_id'
    | 'aws_arn'
    | 'database_connection_string'
    | 'api_key'
    | 'custom_regex';

export interface MaskingRule {
    type: MaskingRuleType;
    enabled: boolean;
    replacement?: string;
    customPattern?: string;
}

export interface DataMaskingConfig {
    enabled: boolean;
    rules: MaskingRule[];
}

export const DEFAULT_DATA_MASKING_CONFIG: DataMaskingConfig = {
    enabled: false,
    rules: [],
};
