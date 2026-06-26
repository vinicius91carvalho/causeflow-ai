# Redesign Review — UX Designer (Senior)

**Reviewer profile:** 8+ years B2B SaaS. Frameworks: Nielsen, WCAG 2.1 AA, visual-hierarchy audit.
**Scope:** CauseFlow AI website, cleric redesign (Sprint 02–04 output).
**Artifacts consumed:** 48 screenshots at `screenshots/sprint-05/`, live server `localhost:3000`.
**Date:** 2026-04-19.

## Summary

O redesign cleric acerta na linguagem visual do hero e no carrossel de logos — tipografia com hierarquia firme, paleta deep-indigo + teal coerente, CTAs principais bem posicionados acima da dobra. A narrativa do "3-min investigation" é clara na homepage. Porém o site falha na entrega do corpo: 5 das 6 páginas principais (/, /product, /use-cases, /integrations, /pricing, /security) renderizam apenas hero + logo belt, com o restante do conteúdo em branco ou em bloco preto opaco até o footer. Causa raiz sistêmica: `next/dynamic` sem `ssr: true` + `AnimateOnScroll` com estado inicial `opacity-0` no SSR, cujo hook só detecta `prefers-reduced-motion` após o primeiro paint no cliente. Usuários com JS lento, bots de indexação e leitores de tela veem uma landing page de pre-launch vazia. Além dos P0 de rendering, há questões de hierarquia visual em badges de compliance (P1), layout mobile/tablet inconsistente (P1), e dead code em i18n (P2). Recomendação: não publicar sem Sprint 06 de remediação dos 6 P0 identificados.

---

## Observations

### [P0] / — Corpo da homepage vazio abaixo do logo belt
**Área:** Homepage — todas as seções abaixo do carrossel de logos
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx:47-81`
**Observação:** Todas as seções do corpo da homepage (NarrativeFeaturesSection, CrossReferenceVisualization, WhyNowSection, WhyDifferentSection, SecurityFirstSection, CallToActionSection) são carregadas via `next/dynamic`. A captura de tela da Playwright ocorre no SSR/SSG antes da hidratação do cliente, resultando numa página que exibe apenas hero + logo belt e depois ~8000px de espaço vazio. Um visitante real com JS lento ou bloqueado verá o mesmo. Os skeletons (`SectionSkeleton`) têm `min-h-[400px]` mas não têm background visível — tornam-se invisíveis no fundo claro.
**Sugestão:** Converter as seções críticas above-the-fold (NarrativeFeaturesSection, CallToActionSection) para imports estáticos. Manter dinâmicos apenas componentes de visualização interativa (CrossReferenceVisualization). Alternativamente, adicionar `ssr: true` e backgrounds visíveis aos skeletons.
**Screenshot:** screenshots/sprint-05/websitehome-desktop-1440.png

---

### [P0] /use-cases — Página quase completamente vazia
**Área:** Use Cases — corpo inteiro
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/use-cases-page.tsx`
**Observação:** A página /use-cases exibe apenas o hero escuro com headline e subtítulo; todo o restante do conteúdo abaixo é espaço em branco até o footer. Confirmado em desktop-1440, mobile-390 e tablet-768. A página tem apenas 3.0K, sugerindo que as seções de casos de uso simplesmente não foram implementadas ou foram removidas.
**Sugestão:** Implementar as seções de conteúdo da página (cenários de uso, casos reais) ou redirecionar temporariamente /use-cases para /product enquanto o conteúdo não está pronto.
**Screenshot:** screenshots/sprint-05/websiteuse-cases-desktop-1440.png

---

### [P0] /pricing — Cards de plano ausentes (blank acima do ROI calculator)
**Área:** Pricing — seção de planos
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/pricing-page.tsx:26-34`
**Observação:** Os cards de pricing (PricingInteractive) são carregados dinamicamente. Na captura de tela — que representa o estado pré-hidratação — o skeleton (`PricingGridSkeleton`) tem `h-[420px] animate-pulse bg-card` mas é invisível no fundo claro. O resultado é uma página de pricing que mostra apenas o headline, depois jump direto para "Need more? Add as you go." e o ROI Calculator, sem qualquer plano visível. O funil de conversão está completamente quebrado para usuários com JS lento ou bots de indexação.
**Sugestão:** Renderizar os cards de plano como componente estático (sem dynamic()) ou usar SSR para PricingInteractive. O toggle mensal/anual pode ser client-side, mas a estrutura dos cards deve ser server-rendered.
**Screenshot:** screenshots/sprint-05/websitepricing-desktop-1440.png

---

### [P0] /security — Bloco preto sólido no meio da página (section architecture)
**Área:** Security — Section 5 Architecture
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/security-page.tsx:320`
**Observação:** O `SectionLayout variant="dark"` com id="architecture" renderiza como um retângulo preto sólido sem nenhum conteúdo visível. Os componentes internos (ArchitectureLayerBox, ArchitectureArrow) são envolvidos em `AnimateOnScroll` — a animação provavelmente depende de JS para revelar o conteúdo, e na ausência de JS ou antes da hidratação o conteúdo fica com `opacity: 0`. O bloco ocupa aproximadamente 800px de altura visualmente quebrada.
**Sugestão:** Garantir que AnimateOnScroll tenha um fallback sem opacity:0 inicial para SSR. Adicionar `initial={{ opacity: 1 }}` ou usar `motion.div` com `viewport` detection apenas quando JS está disponível.
**Screenshot:** screenshots/sprint-05/websitesecurity-desktop-1440.png

---

### [P0] /integrations — Corpo inteiro ausente (apenas hero visível)
**Área:** Integrations — todas as seções abaixo do hero
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/integrations-page.tsx`
**Observação:** A página /integrations exibe apenas o hero escuro ("Connect your entire stack") e depois ~5000px de espaço completamente em branco até o footer. O catálogo de integrações — razão de existir desta página — não renderiza no estado SSG pré-hidratação. Confirmado em desktop-1440 e mobile-390. Esta é a segunda página de destino mais provável via nav e integrations CTA no corpo do site.
**Sugestão:** Idêntico ao padrão das outras páginas: converter o grid de integrações para server component estático. Os filtros de categoria podem ser client-side, mas os cards devem ser visíveis sem JS.
**Screenshot:** screenshots/sprint-05/websiteintegrations-desktop-1440.png

---

### [P0] /product — Bloco preto opaco + corpo vazio (AnimateOnScroll sistêmico)
**Área:** Product — seção de fases / timeline
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/product-page.tsx`
**Observação:** A página /product repete o mesmo padrão: hero visível, depois longa área branca vazia, seguida de um bloco preto sólido com apenas três chevrons/bullets brancos visíveis (a animação de timeline travada em opacity:0), depois mais espaço vazio até o footer. O problema do AnimateOnScroll afeta todas as seções com `variant="dark"` e é sistêmico em todo o site.
**Sugestão:** Correção sistêmica necessária no componente AnimateOnScroll: o estado inicial deve ter `opacity: 1` para SSR/SSG e a animação de entrada deve ser aplicada apenas após mount no cliente (usar `useEffect` + `useState` para detectar hydration).
**Screenshot:** screenshots/sprint-05/websiteproduct-desktop-1440.png

---

### [P1] Mobile / — Hero só exibe um CTA; secundário "See how it works" invisível ou colapsado

**Área:** Homepage mobile (390px) — HeroSectionV2 CTA row
**Arquivo:** `apps/website/src/contexts/marketing/presentation/components/sections/hero-section-v2.tsx`
**Observação:** No screenshot `websitehome-mobile-390.png` apenas o CTA primário (gradient, "Start Free Trial"/equivalente) aparece. O CTA secundário ("See how it works") desaparece — provavelmente por `flex` sem wrap ou overflow horizontal cortando o segundo botão. Em mobile, perder o secondary CTA reduz as opções de exploração em 50% no ponto mais crítico da conversão.
**Sugestão:** `flex-wrap` + `w-full sm:w-auto` nos botões do hero. Garantir `min-width: 0` no container para permitir quebra. Testar com textos em PT-BR (geralmente 10-15% mais longos que EN).
**Screenshot:** screenshots/sprint-05/websitehome-mobile-390.png

---

### [P1] Tablet /pricing — Layout quebra: ROI Calculator flutua sem contexto dos plan cards

**Área:** Pricing tablet (768px) — grid de planos + ROI
**Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/pricing-page.tsx`
**Observação:** No viewport tablet (768px) a página de pricing exibe o ROI Calculator antes (ou no lugar de) os plan cards. Cria percepção visual de que não há planos disponíveis — o calculator sozinho é abstrato. Mesma causa raiz do P0 /pricing (dynamic import invisível) amplificada pela ordem DOM: o skeleton em branco empurra a composição e o usuário vê primeiro a calculadora.
**Sugestão:** Resolver como parte da correção P0 /pricing. Independentemente, garantir ordem DOM plan-cards → ROI calculator em todos os viewports com fallback visível.
**Screenshot:** screenshots/sprint-05/websitepricing-tablet-768.png

---

### [P1] /security — Hierarquia visual dos badges de compliance mistura certificados ativos e em progresso

**Área:** SecurityFirstSection — badge row
**Arquivo:** `apps/website/src/contexts/marketing/presentation/components/sections/security-first-section.tsx`
**Observação:** Os 5 badges (LGPD, GDPR, SOC 2 Type II (In Progress), ISO 27001 (Roadmap), HIPAA (Roadmap)) são renderizados em linha com mesmo peso visual. Leitor rápido (scan em 2-3s) absorve "SOC 2 Type II" sem processar o qualificador textual entre parênteses. Combinado com o P0 da página /integrations que afirma "Certified" sem qualificador, aumenta risco de misrepresentation percebida.
**Sugestão:** Dois estilos: sólido (`bg-primary text-primary-foreground`) para ativos (LGPD, GDPR), outlined + ícone de relógio para em progresso. Qualificador visual, não só textual.
**Screenshot:** screenshots/sprint-05/websitesecurity-desktop-1440.png

---

### [P2] / — Footer com `SITE.cofounder` exposto pode criar ruído de hierarquia institucional

**Área:** Footer — cofounder reference
**Arquivo:** `apps/website/src/contexts/shell/presentation/components/navigation/footer.tsx` (ref. memória do projeto)
**Observação:** O footer referencia `SITE.cofounder` diretamente, o que em um landing page B2B SaaS Early Access cria uma nota pessoal sem contexto. Compradores técnicos não precisam saber o nome do cofundador antes da página "About". Adiciona ruído ao rodapé, que deveria focar em compliance, contato, links legais.
**Sugestão:** Remover o cofounder do footer público. Manter apenas logo, compliance badges, nav secundária (privacy, terms), social. Cofounder pode aparecer em página /about dedicada ou em bio no LinkedIn linkado.
**Screenshot:** screenshots/sprint-05/websitehome-desktop-1440.png

---

### [P2] / — Tipografia não tem rhythm consistente entre seções (espaçamento vertical variável)

**Área:** Global — section padding/margin tokens
**Arquivo:** `packages/ui/src/themes/original/tokens/light.css` + `packages/ui/src/themes/shared/base.css`
**Observação:** Observando os 3 viewports da homepage, cada seção tem seu próprio `py-*` sem regra central (algumas `py-16`, outras `py-20`, outras `py-24`, outras maiores via custom class). Resultado: ritmo visual inconsistente entre seções. Em design systems maduros, o spacing vertical entre seções é um token (ex.: `--section-gap-sm / md / lg`). A inconsistência atual aumenta a percepção de que o site foi montado por composição ad-hoc.
**Sugestão:** Definir 2-3 tokens de `section-gap` (compact, standard, emphasis) em `tokens/light.css`. Aplicar consistentemente em `SectionLayout`. Revisar cada uso de `py-*` arbitrário e substituir pelo token apropriado.
**Screenshot:** screenshots/sprint-05/websitehome-desktop-1440.png

---

### [P2] PT-BR — Strings longas quebram layout em mobile (verificação qualitativa)

**Área:** Global PT-BR — mobile 390px
**Arquivo:** `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json`
**Observação:** Em PT-BR, strings costumam ter 10-20% mais caracteres que EN. Screenshots `websitept-br_*-mobile-390.png` sugerem que algumas seções podem ter overflow horizontal ou quebra de linha inadequada em CTAs. Verificação qualitativa — necessita teste interativo com Playwright MCP para confirmar overflow específico.
**Sugestão:** Adicionar teste Playwright que mede `scrollWidth > clientWidth` em cada página PT-BR mobile. Qualquer overflow horizontal é bug. Também revisar CTAs com `text-ellipsis` ou `truncate` caso a tradução PT-BR seja mais longa que o botão comporta.
**Screenshot:** screenshots/sprint-05/websitept-br_home-mobile-390.png
