# monorepo-root-oss-dx workflow journal

## 2026-07-12T20:03:25.110Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-062
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-12T20:03:53.942Z — Integrated Verification defect

- Attempt: 1/3
- WorkItem: WI-AC-062
- Defects: expected rendered `docker compose -f docker-compose.yml config` to include existing OSS platform services plus `causeflow-docs` mapping host :5181 to container :3000 (website host :3000 retained); observed compose file exists and `docker compose -f docker-compose.yml config` exits 0 with services redis, causeflow-postgres, causeflow-api, causeflow-dashboard, causeflow-website (published 3000→target 3000), causeflow-worker, hindsight, but no `causeflow-docs` service and no 5181:3000 mapping anywhere in source or rendered config; evidence `test -f docker-compose.yml` → EXISTS=yes; config EXIT=0; `docker compose ... config --services` lists seven services without docs; `rg causeflow-docs|5181 docker-compose.yml` → NO_DOCS_MATCH; rendered ports show website published\"3000\"/target 3000 only
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/c8496d78-3516-48a6-a86b-cd1511195bfd/monorepo-root-oss-dx/WI-AC-062-1-integration_qa-065a9b86d15d3f07.log
- NextAction: Repair Plan

## 2026-07-12T20:06:01.014Z — QA defect and Repair Plan

- Attempt: 1/3
- WorkItem: WI-AC-062
- DefectReport: expected rendered `docker compose -f docker-compose.yml config` to include existing OSS platform services plus `causeflow-docs` mapping host :5181 to container :3000 (website host :3000 retained); observed compose file exists and `docker compose -f docker-compose.yml config` exits 0 with services redis, causeflow-postgres, causeflow-api, causeflow-dashboard, causeflow-website (published 3000→target 3000), causeflow-worker, hindsight, but no `causeflow-docs` service and no 5181:3000 mapping anywhere in source or rendered config; evidence `test -f docker-compose.yml` → EXISTS=yes; config EXIT=0; `docker compose ... config --services` lists seven services without docs; `rg causeflow-docs|5181 docker-compose.yml` → NO_DOCS_MATCH; rendered ports show website published\"3000\"/target 3000 only
- RepairPlan: AC-062 failed because QA validated web/docker-compose.yml (7 platform services, no docs/5181). The real monorepo-root umbrella already includes public-docs and currently renders causeflow-docs published 5181→target 3000 with website 3000 retained.; Do not add causeflow-docs into web/docker-compose.yml (wrong layer; duplicates under root include).; Keep monorepo-root docker-compose.yml including ./web/docker-compose.yml and ./public-docs/docker-compose.yml with causeflow-docs ports 5181:3000.; Confirm public-docs/docker-compose.yml + Dockerfile remain present (already satisfy PD-DOCS-LOCAL-PORT).; Re-run AC-062 from monorepo root (parent of web/), not WORKDIR=web; if harness observation is fixed to web/, change observation cwd/path for context monorepo-root-oss-dx to the parent compose file.; Leave root init.sh/README.md/docs-pages.yml for AC-063..065; not required to close AC-062.
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/c8496d78-3516-48a6-a86b-cd1511195bfd/monorepo-root-oss-dx/WI-AC-062-1-integration_qa-065a9b86d15d3f07.log
- NextAction: Coding Attempt 2
