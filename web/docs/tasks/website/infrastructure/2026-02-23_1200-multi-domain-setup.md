# Multi-Domain Setup: causeflow.io, causeflow.com.br + www redirects

All domains redirect to `https://causeflow.ai` (301). DNS delegated to Route 53.

## Phase 1: Create Route 53 Hosted Zones
- [x] Create hosted zone for `causeflow.io` — Zone ID: `Z06305481X335F3D003NZ`
- [x] Create hosted zone for `causeflow.com.br` — Zone ID: `Z06228343H2VX6MFLIRF8`
- [x] Record NS servers for both zones (see below)

## Phase 2: GoDaddy NS Delegation (user action)
- [x] User updates GoDaddy NS records for `causeflow.io`
- [x] User updates GoDaddy NS records for `causeflow.com.br`
- [x] Verify NS propagation — both domains now on AWS nameservers

## Phase 3: Update SST Config
- [x] Update `sst.config.ts` to use `domain.redirects` with all redirect domains
- [x] Add: `www.causeflow.ai`, `causeflow.io`, `www.causeflow.io`, `causeflow.com.br`, `www.causeflow.com.br`

## Phase 4: Deploy & Verify
- [x] Deploy to production: `sst deploy --stage production`
- [x] Verify all domains redirect to `https://causeflow.ai`
