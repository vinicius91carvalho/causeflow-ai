# Domain Redirects: causeflow.io → causeflow.ai & causeflow.com.br → causeflow.ai/pt-br/

## Context (The Why)
The user owns causeflow.io and causeflow.com.br domains and wants them to redirect to causeflow.ai. The .com.br domain should redirect to the Portuguese version (/pt-br/).

Previous attempts were made but neither redirect is currently working:
- causeflow.io: SST config already includes it in `redirects` array, but GoDaddy NS delegation was never set up → DNS SERVFAIL
- causeflow.com.br: Route 53 NS delegation works, but the CloudFront distribution deploy was cancelled → no A records, distribution doesn't exist

## Definition (The What)
1. **causeflow.io** → 301 redirect to `https://causeflow.ai` (hostname-only, SST handles this)
2. **causeflow.com.br** → 301 redirect to `https://causeflow.ai/pt-br/<path>` (path-preserving, needs CloudFront Function)
3. Both `www.` variants should also redirect

## Acceptance Criteria (The How to Test)
- [x] `curl -sI https://causeflow.io/` returns `301` with `Location: https://causeflow.ai/`
- [x] `curl -sI https://www.causeflow.io/` returns `301` with `Location: https://causeflow.ai/`
- [x] `curl -sI https://causeflow.com.br/` returns `301` with `Location: https://causeflow.ai/pt-br/`
- [x] `curl -sI https://www.causeflow.com.br/` returns `301` with `Location: https://causeflow.ai/pt-br/`
- [x] `curl -sI https://causeflow.com.br/pricing` returns `301` with `Location: https://causeflow.ai/pt-br/pricing`

## Restrictions (The Boundaries)
- causeflow.io redirect is SST-managed (already in `redirects` array) — just needs DNS delegation
- causeflow.com.br redirect MUST be managed outside SST (AWS CLI) to avoid ACM cert validation blocking deploys
- Never deploy SST locally — use CI/CD for website deploys
- AWS CLI operations for .com.br infra can be done locally (they're manual, outside Pulumi state)

## Current AWS State

### causeflow.io
- Route 53 hosted zone: Z06465643HDJ89IO30HN8
- NS records: ns-781.awsdns-33.net, ns-2013.awsdns-59.co.uk, ns-406.awsdns-50.com, ns-1379.awsdns-44.org
- ACM validation CNAMEs: present in zone
- A/AAAA records: NONE (SST will create on next deploy after NS delegation)
- GoDaddy NS delegation: NOT SET UP (DNS returns SERVFAIL)

### causeflow.com.br
- Route 53 hosted zone: Z06468712PG18EQG6DO7I
- NS records: ns-1971.awsdns-54.co.uk, ns-1082.awsdns-07.org, ns-40.awsdns-05.com, ns-894.awsdns-47.net
- GoDaddy NS delegation: WORKING (dig resolves to AWS NS)
- A/AAAA records: NONE
- CloudFront distribution EVVQAGVTWPRZ2: DOES NOT EXIST (deploy was cancelled)
- CloudFront Function: UNKNOWN (may need recreation)

## Phase 1: Fix causeflow.io DNS Delegation
- [x] Provide user with the 4 AWS nameservers to set at GoDaddy/registrar for causeflow.io
- [x] User confirms NS delegation is set up at registrar
- [x] Verify DNS resolves: `dig causeflow.io NS +short` returns AWS nameservers
- [x] Trigger website production deploy to let SST create the redirect infrastructure
  - Run ID: 22830501799
- [x] Verify redirect works: `curl -sI https://causeflow.io/` → 301 to causeflow.ai

## Phase 2: Create causeflow.com.br CloudFront Infrastructure (AWS CLI)
- [x] Create ACM certificate in us-east-1 for causeflow.com.br + www.causeflow.com.br
  - ARN: arn:aws:acm:us-east-1:409171461008:certificate/efdbed9c-a0cb-4717-a845-8f93c652cfb0
- [x] Add DNS validation CNAME records to Route 53 hosted zone
  - Change ID: C0912050VB2UHFRCUMB2
- [x] Wait for ACM cert to validate (status: ISSUED)
- [x] Create CloudFront Function for 301 redirect (causeflow.com.br → causeflow.ai/pt-br/<path>)
  - ARN: arn:aws:cloudfront::409171461008:function/causeflow-com-br-redirect
- [x] Create CloudFront distribution with: ACM cert, CNAMEs, Function association
  - Distribution ID: E214WXV30A2Q96 (d15va8gxx5e2st.cloudfront.net)
- [x] Create Route 53 A + AAAA alias records pointing to CloudFront distribution
  - Change ID: C030814111XET692Q54JS
- [x] Update sst.config.ts comments with new resource IDs

## Phase 3: Verify All Redirects
- [x] Test causeflow.io → causeflow.ai (301)
- [x] Test www.causeflow.io → causeflow.ai (301)
- [x] Test causeflow.com.br → causeflow.ai/pt-br/ (301)
- [x] Test www.causeflow.com.br → causeflow.ai/pt-br/ (301)
- [x] Test path preservation: causeflow.com.br/pricing → causeflow.ai/pt-br/pricing (301)

## Phase 4: Compound
- [ ] Update sst.config.ts comments with final resource IDs
- [x] Update task file with learnings
- [x] Update patterns.md if any new patterns emerged

## Key Files
- `apps/website/sst.config.ts` — lines 131-184 (domain config + .com.br comments)
