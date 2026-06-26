package relay.authz

import rego.v1

default allow := false

decision := {
    "allowed": allow,
    "reason": reason,
    "requiresApproval": requires_approval,
}

# Allow execute operations if:
# 1. Tenant is in allowed list
# 2. Resource/operation pair is permitted for the tenant
# 3. Request is not targeting a blocked table
allow if {
    input.command.operation in allowed_operations
    not blocked_table_access
}

allowed_operations := {"query", "describe_table", "list_tables", "explain"}

blocked_tables := {"users_private", "kms_keys", "access_tokens"}

blocked_table_access if {
    table := input.command.params.tableName
    table in blocked_tables
}

requires_approval if {
    input.command.operation == "query"
    input.command.params.limit > 5000
}

requires_approval if {
    sensitive_table
}

sensitive_tables := {"payment_tokens", "patient_records"}

sensitive_table if {
    input.command.params.tableName in sensitive_tables
}

reason := "blocked table" if blocked_table_access
reason := "operation not allowed" if not input.command.operation in allowed_operations
