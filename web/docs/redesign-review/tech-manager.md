# Redesign Review — Tech Manager / CTO

**Reviewer profile:** 10+ anos de liderança em SRE/DevOps. Comprador de ferramentas de resposta a incidentes.
**Competitors in mind:** resolve.ai, incident.io, Rootly, IncidentFox.
**Scope:** Avaliação do site CauseFlow AI como comprador prospectivo.
**Artifacts consumed:** 8 screenshots (desktop-1440 + mobile-390), código-fonte das páginas e i18n EN/PT-BR, constantes de preço e integrações.
**Date:** 2026-04-19.

## Summary

O site transmite uma proposta de valor clara e tecnicamente credível — "investigação em ~3 min, human-in-the-loop, dados nunca saem do seu ambiente" — que se diferencia genuinamente de resolve.ai e incident.io no eixo privacidade. Avançaria para uma avaliação técnica. Três lacunas travam a decisão de compra: (1) as páginas `/integrations` e `/security` se contradizem nos status de certificação SOC 2 e ISO 27001 — a página de integrações afirma "Certified" enquanto a página de segurança corretamente diz "In Progress/Roadmap", o que destruiria a credibilidade durante due diligence; (2) as páginas de casos de uso e integrações não renderizam conteúdo após o hero (componentes invisíveis), bloqueando dois dos três vetores de avaliação técnica; (3) o modelo de preço não tem plano gratuito nem período de trial definido — "Early Access, join the list" não é suficiente para uma equipe de engenharia estimar TCO ou iniciar uma prova de conceito.

---

## Observations

### [P0] /integrations — Afirmações de certificação SOC 2 e ISO 27001 contradizem a página /security

**Área:** Integrations — Integration Security section
**Arquivo:** `apps/website/src/contexts/marketing/infrastructure/i18n/en.json:351-354` (integrations.security.soc2Title / iso27001Title)
**Observação:** A seção "Integration Security" da página `/integrations` apresenta dois cards como fatos consumados: "SOC 2 Certified" e "ISO 27001:2022 Certified". A página `/security` (compliance section, linha 93-106 do `security-page.tsx`) corretamente marca `isCompliant: false` para SOC 2 Type II ("In Progress") e ISO 27001 ("On Roadmap"). Qualquer engenheiro de segurança que navegar pelas duas páginas durante due diligence vai identificar a contradição imediatamente. Afirmação de certificação falsa ou prematura em site de produto é bloqueador contratual em empresas com >50 engenheiros — departamentos jurídicos e de compliance tratam isso como misrepresentation. O risco reputacional supera o ganho de marketing.
**Sugestão:** Alinhar o copy da seção Integration Security com o status real: substituir "SOC 2 Certified" por "SOC 2 Type II (In Progress — audit initiated)" e "ISO 27001:2022 Certified" por "ISO 27001 (On Roadmap)". Usar os mesmos badges qualificados já presentes no footer e na `/security`.
**Screenshot:** screenshots/sprint-05/websiteintegrations-desktop-1440.png

---

### [P0] /integrations — Página renderiza apenas o hero; catálogo de integrações e seções subsequentes estão invisíveis

**Área:** Integrations — Integration catalog (body)
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/integrations-page.tsx:67-76` (IntegrationFilter component)
**Observação:** O screenshot desktop-1440 mostra o hero escuro com título "Connect your entire stack" seguido de aproximadamente 3.500px de fundo cinza vazio antes do footer. Os 40+ registros em `INTEGRATIONS` (`packages/shared/src/domain/constants/integrations.ts`) e a seção "Integration Security" não aparecem. Para um CTO avaliando breadth de integrações (primeiro critério de eliminação vs. ferramentas existentes como Datadog + PagerDuty nativos), uma página em branco é descarte imediato — não há como validar se Splunk, ServiceNow ou Kubernetes estão realmente suportados.
**Sugestão:** Investigar o componente `IntegrationFilter` — provável erro de hidratação client-side ou import dinâmico sem fallback. Verificar com `pnpm --filter website build && pnpm --filter website start` se o problema é SSG ou runtime. Adicionar skeleton visível durante carregamento para que o conteúdo nunca apareça como ausente.
**Screenshot:** screenshots/sprint-05/websiteintegrations-desktop-1440.png

---

### [P0] /use-cases — Página renderiza apenas o hero; três casos de uso reais estão invisíveis

**Área:** Use Cases — story sections
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/use-cases-page.tsx:57-71` (UseCaseStorySection loop)
**Observação:** O screenshot desktop-1440 da `/use-cases` mostra "Real Incidents. Real Resolutions." no hero e ~2.000px de área cinza vazia até o footer. Os três casos de uso (`pricingStale`, `brokenImages`, `getStarted500`) não renderizam. Esta é a página que mais importa para um CTO técnico: é onde a promessa "~3 min" se torna concreta com evidência de investigação real. Sem ela, a avaliação técnica fica bloqueada — o comprador não consegue checar se o nível de detalhe dos agentes (847 log lines, confidence 91%) é real ou marketing.
**Sugestão:** Mesmo diagnóstico do `/integrations` — componente `UseCaseStorySection` ou o módulo `USE_CASES` (importado de `@/contexts/marketing/presentation/data/use-cases`) não está sendo renderizado. Verificar se o arquivo `data/use-cases.ts` existe e exporta corretamente. Adicionar Playwright test `expect(page.locator('[data-testid="use-case-story"]').first()).toBeVisible()` para proteger contra regressão.
**Screenshot:** screenshots/sprint-05/websiteuse-cases-desktop-1440.png

---

### [P0] /product — Seções de produto não renderizam após o hero (mesma classe de problema)

**Área:** Product — how-it-works, timeline, audit trail
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/product-page.tsx`
**Observação:** O screenshot desktop-1440 de `/product` mostra o hero "How CauseFlow Solves Incident Investigation" seguido de área cinza vazia, uma faixa escura com três ícones quase invisíveis, e mais área cinza. As fases do pipeline (receive → investigate → identify → recommend → learn → audit), que são o principal argumento técnico do produto, não estão visíveis. Um CTO que clica em "See How It Works" a partir do hero da homepage e encontra uma página em branco encerra a avaliação.
**Sugestão:** Padrão idêntico às páginas /integrations e /use-cases. Provavelmente a mesma causa raiz (AnimateOnScroll, dynamic import ou componente client-side não hidratando em SSG). Resolver as três páginas em conjunto — verificar se `AnimateOnScroll` com IntersectionObserver funciona em SSG sem `window`.
**Screenshot:** screenshots/sprint-05/websiteproduct-desktop-1440.png

---

### [P1] /pricing — Ausência de plano gratuito ou trial estruturado bloqueia avaliação de POC

**Área:** Pricing — planos e CTA
**Arquivo:** `packages/shared/src/domain/constants/pricing.ts:3-88`
**Observação:** O menor plano pago começa em $99/mês (Starter: 15 investigações). A FAQ responde "Is there a free trial?" com "Contact us for Early Access — we'll work with you." Para uma equipe de 5-10 engenheiros avaliando CauseFlow contra Rootly (que tem trial de 14 dias) ou incident.io (freemium até certo volume), a ausência de um caminho de auto-serviço para POC gera atrito imediato. O TCO de uma POC inclui o custo de agenda — "join the list" adia a decisão de compra por semanas. O `plans.free` existe no i18n mas não há plano Free no `PRICING_PLANS`, o que sugere que foi removido sem atualizar a chave.
**Sugestão:** Definir um plano de trial de 14 dias (5 investigações gratuitas, sem cartão) ou um Starter com trial embutido. Alternativamente, tornar o caminho de POC mais explícito: "Book a 30-min technical demo — we run a live investigation on your stack." Remover a chave `plans.free` do i18n se não houver plano gratuito.
**Screenshot:** screenshots/sprint-05/websitepricing-desktop-1440.png

---

### [P1] /pricing — Modelo de preço por investigação sem definição clara de "evento" cria risco de bill-shock

**Área:** Pricing — overage / quota model
**Arquivo:** `packages/shared/src/domain/constants/pricing.ts:9` e `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` (pricing.faq.q1)
**Observação:** O modelo tem dois contadores: investigações ($8,99/extra) e eventos ($0,20/extra). A FAQ define "investigation" mas não define "event" — o que conta como 1 evento? Um log line? Uma chamada de API? Uma métrica consultada? Para times de engenharia maiores com picos de incidente, a incerteza sobre a unidade de consumo de eventos é um bloqueador de orçamento: o procurement não aprova contratos com variável de custo indefinida. O Starter inclui 500 eventos/mês — em um incidente real com 847 log lines (conforme exemplo do howItWorks), o plano Starter estoura na primeira investigação.
**Sugestão:** Adicionar definição de "evento" visível na página de pricing (não só na FAQ): "1 evento = 1 fonte de dado consultada (ex.: 1 query de log, 1 métrica lida, 1 ticket lido)." Rever se 500 eventos/mês no Starter é realista dado o exemplo de 847 log lines no hero. Considerar renomear para unidade mais intuitiva (ex.: "data sources consulted").
**Screenshot:** screenshots/sprint-05/websitepricing-desktop-1440.png

---

### [P1] /security — "Privacy-Preserving Mode" (Docker agent) sem SLA de disponibilidade nem modelo de suporte

**Área:** Security — Deployment approaches
**Arquivo:** `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` (deploymentApproaches.privacyPreserving)
**Observação:** O modo Privacy-Preserving (Docker agent rodando na infraestrutura do cliente) é o diferencial competitivo mais forte do CauseFlow — nenhum concorrente tem isso. Porém o site não responde: quem opera o agent? Quem faz upgrade quando há CVE no container? Qual o SLA se o agent cair? O modelo de suporte listado é "Email + Slack (plan dependent)" — o mesmo do Connected Mode. Para uma empresa com política de patch obrigatório em 72h, um container sem SLA de atualização é um risco de segurança em si. A seção afirma "raw data never leaves your environment" mas não explica o processo de atualização do agent, o que levanta a questão: como a CauseFlow acessa o agent para updates sem criar um vetor de entrada?
**Sugestão:** Adicionar seção "Agent Lifecycle" na `/security`: frequência de releases, canal de distribuição (pull vs push), política de patch de segurança, e como o cliente valida a integridade do container (digest SHA). Diferenciar explicitamente o SLA do Privacy Mode do Connected Mode para justificar o valor agregado.
**Screenshot:** screenshots/sprint-05/websitesecurity-desktop-1440.png

---

### [P1] /integrations — Nenhuma indicação de status de implementação ("available now" vs "coming soon") nas integrações

**Área:** Integrations — catálogo (quando renderiza)
**Arquivo:** `packages/shared/src/domain/constants/integrations.ts:3-375`
**Observação:** O `INTEGRATIONS` array contém 40+ entradas (AWS CloudWatch, Datadog, Sentry, PagerDuty, ServiceNow, Salesforce, Argo CD, etc.) sem nenhum campo `status`, `available`, ou `comingSoon`. Em Early Access, é improvável que todas as 40+ integrações estejam implementadas e testadas. Um CTO que identifica Salesforce + ServiceNow + Argo CD como "available" e depois descobre no onboarding que são roadmap itens vai cancelar imediatamente — esse é o padrão clássico de churn em ferramentas de infraestrutura. O campo `featured: true/false` existe mas não sinaliza disponibilidade.
**Sugestão:** Adicionar campo `status: 'ga' | 'beta' | 'coming-soon'` no tipo `Integration`. Exibir badge "Beta" ou "Em breve" nas integrações não-GA. Priorizar honestidade sobre aparência de breadth — buyers técnicos preferem "8 integrações GA + roadmap claro" a "40 integrações sem status".
**Screenshot:** screenshots/sprint-05/websiteintegrations-desktop-1440.png

---

### [P1] / — Hero do produto (dashboard preview) não carrega — campo visual central está vazio

**Área:** Homepage — hero / product visualization
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx`
**Observação:** O screenshot desktop-1440 da homepage mostra o hero com headline "Stop hunting logs. Ship the fix." e o sub-headline, mas o painel central (onde deveria estar o dashboard preview com "Root Cause Identified / 97% confidence") contém apenas um ícone pequeno centralizado em um box vazio. A visualização do produto é o elemento de maior impacto em tempo de conversão — é o primeiro sinal concreto de que a ferramenta existe e funciona. Sem ela, o site parece um landing page de pre-launch genérico.
**Sugestão:** Investigar se o componente de preview do dashboard tem o mesmo problema de hidratação das outras páginas. Como alternativa imediata, substituir por um screenshot estático do dashboard real (ou mockup de alta fidelidade) em SSG — elimina a dependência de JavaScript para o elemento mais crítico da página.
**Screenshot:** screenshots/sprint-05/websitehome-desktop-1440.png

---

### [P2] /security — Badges de compliance no SecurityFirstSection misturam status sem hierarquia visual clara

**Área:** Security — SecurityFirstSection badges
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/security-page.tsx:189-195`
**Observação:** Os cinco badges são renderizados linearmente: `LGPD`, `GDPR`, `SOC 2 Type II (In Progress)`, `ISO 27001 (Roadmap)`, `HIPAA (Roadmap)`. O texto qualificador "(In Progress)" e "(Roadmap)" está inline na string do badge, sem diferenciação visual (cor, ícone, estilo). Um CTO lendo rapidamente pode absorver "SOC 2 Type II" sem processar o qualificador. O footer tem o mesmo padrão. Ao mesmo tempo, a security page mostra corretamente `isCompliant: false` para esses itens na compliance table — mas essa seção fica mais abaixo na página e pode nunca ser vista.
**Sugestão:** Usar dois estilos de badge distintos: badge sólido (verde/teal) para certificações ativas (LGPD, GDPR) e badge outlined/cinza com ícone de relógio para as em andamento. O qualificador deve ser visualmente evidente, não apenas textual.
**Screenshot:** screenshots/sprint-05/websitesecurity-desktop-1440.png

---

### [P2] /pricing — ROI Calculator usa valores padrão que não refletem cenário típico do ICP

**Área:** Pricing — ROI Calculator
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/pricing-page.tsx:179-213`
**Observação:** O screenshot mostra o ROI Calculator com valores padrão: 10 incidentes/mês, duração média não visível, 10 engenheiros — resultando em "Estimated annual savings: $0". Um savings de $0 como primeira impressão do calculator destrói o argumento de TCO antes de o comprador ajustar os sliders. O ICP declarado é "2-50 engineers" — um time de 10 engenheiros com 10 incidentes/mês provavelmente tem savings reais, mas o valor padrão não demonstra isso.
**Sugestão:** Calibrar os valores default para o cenário mediano do ICP: 15 incidentes/mês, 4h de investigação média, 8 engenheiros a $150/h — isso gera um savings anual positivo e imediato. A primeira impressão do calculator deve ser um número que justifique a conversa, não zero.
**Screenshot:** screenshots/sprint-05/websitepricing-mobile-390.png

---

### [P2] /integrations — Copy da seção "Integration Security" usa "independently audited and certified" como claim geral sem qualificação

**Área:** Integrations — Integration Security description
**Arquivo:** `apps/website/src/contexts/marketing/infrastructure/i18n/en.json:350` (integrations.security.description)
**Observação:** O subtítulo da seção afirma: "Our integration infrastructure is independently audited and certified to meet the highest security standards for enterprise data access." Esta frase não qualifica quais certificações estão ativas — funciona como afirmação de certificação plena. Em conjunto com os cards "SOC 2 Certified" e "ISO 27001:2022 Certified" (P0 acima), cria uma camada adicional de misrepresentation. Mesmo após corrigir os títulos dos cards, este subtítulo precisa ser revisado.
**Sugestão:** Substituir por: "Nossa infraestrutura de integração segue controles de segurança enterprise com LGPD e GDPR compliance desde o lançamento. SOC 2 Type II em andamento, ISO 27001 no roadmap."
**Screenshot:** screenshots/sprint-05/websiteintegrations-desktop-1440.png

---

### [P2] PT-BR — Chave `plans.free` existe no i18n mas não mapeia para nenhum plano real

**Área:** Pricing (PT-BR e EN) — consistência entre i18n e constantes
**Arquivo:** `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` (pricing.plans.free) + `packages/shared/src/domain/constants/pricing.ts`
**Observação:** A chave `pricing.plans.free: "Free"` existe no i18n EN e PT-BR mas `PRICING_PLANS` não contém nenhum plano com `id: 'free'`. Isso é dead code que pode causar confusão para qualquer pessoa lendo o código ou traduzindo — e se algum dia a chave for referenciada por engano, exibirá "Free" sem o plano correspondente. PT-BR está sintaticamente paridade com EN (zero missing keys), o que é positivo — mas a paridade está preservando um artefato morto.
**Sugestão:** Remover `pricing.plans.free` de EN e PT-BR, ou introduzir um plano free/trial correspondente (ver P1 acima). A paridade PT-BR é boa — manter esse padrão mas com conteúdo correto.
**Screenshot:** screenshots/sprint-05/websitept-br_pricing-desktop-1440.png
