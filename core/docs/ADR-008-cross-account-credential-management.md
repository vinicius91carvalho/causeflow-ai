# ADR-008: Cross-Account Credential Management

| Campo | Valor |
|-------|-------|
| **Status** | ✅ Aceito |
| **Criticidade** | 🔴 Crítica |
| **Data** | Fevereiro 2026 |
| **Autor** | AI SRE Platform — Architecture Team |
| **Referências** | [Datadog Security Labs](https://securitylabs.datadoghq.com/articles/securely-integrating-with-customers-aws-accounts/), [AWS SaaS Lens](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/), [Praetorian Research](https://www.praetorian.com/blog/aws-iam-assume-role-vulnerabilities/) |

---

## 1. Contexto & Problema

O PRD original **NÃO cobria** gestão de credenciais cross-account. Para uma plataforma AI SRE que investiga incidentes em contas AWS/Azure de clientes, o acesso seguro à infraestrutura do cliente é o pilar mais crítico da arquitetura.

**Perguntas que este ADR responde:**
- Como nos conectamos à conta AWS do cliente?
- O cliente cria IAM Role? Passa secrets?
- Como garantimos least privilege por sub-agente?
- O que acontece se nosso backend for comprometido?

---

## 2. Decisão

**NUNCA armazenamos credenciais de clientes.** Utilizamos exclusivamente **IAM Roles com cross-account AssumeRole**, garantindo que todas as credenciais são temporárias (máximo 1 hora), tenant-scoped e auditáveis.

### Princípios Fundamentais

| Princípio | Detalhe |
|-----------|---------|
| **Zero Secrets Stored** | N