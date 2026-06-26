# Sprint 01 — Design System Foundation

**Parent PRD:** `docs/tasks/website/design/2026-04-18_1900-cleric-redesign/spec.md`
**Duration:** 60–75 min
**Depends on:** —
**Blocks:** S2, S3, S4, S5

---

## Goal

Publicar um novo tema `cleric/` em `@causeflow/ui` alinhado aos tokens extraídos de `/root/projects/causeflow/causeflow-new-home.html`, mais as fontes (Plus Jakarta Sans, Space Grotesk, JetBrains Mono) e os tokens semânticos compartilhados `--warning` / `--success` (se ainda não existirem). Deixar o tema pronto para consumo em ambos apps (website + dashboard). Manter o tema `original/` intacto como legado.

## Scope (bullets)

1. Criar diretório `packages/ui/src/themes/cleric/` com `entry.css`, `tokens/light.css`, `tokens/dark.css`, `README.md`.
2. Declarar todos os tokens listados abaixo (light + dark) em HSL sem `hsl(...)` wrapper (ex: `--primary: 232 50% 18%;`) para compatibilidade com Tailwind v4 color utilities.
3. Adicionar fontes via `@import` Google Fonts no `cleric/entry.css` (Plus Jakarta Sans 300–800, Space Grotesk 400–700, JetBrains Mono 400–600) OU preload via `<link>` em `app/layout.tsx` — escolher a abordagem que o projeto já usa consultando `themes/original/fonts/font-stacks.css`.
4. Se tokens semânticos `--warning` / `--success` (e `-foreground`) ainda não existem em `shared/base.css`, adicionar no `@theme` block.
5. Registrar o novo tema em `packages/ui/src/themes/entry.css` (import cleric entry) e definir `cleric` como tema default ajustando `config.json` se existir.
6. Ajustar importação de CSS no website (via `@causeflow/ui/styles` em `apps/website/src/app/[locale]/layout.tsx`) e no dashboard (`apps/dashboard/src/app/[locale]/globals.css`) para garantir que a importação ativa é do `@causeflow/ui` entry (sem duplicar imports). Website **não tem** `globals.css` próprio — imports vêm do package.
7. Criar smoke component (test file) que usa `bg-warning text-warning-foreground` + `bg-success` + `bg-accent` + `font-display` e verifica que renderiza — pode ser um Vitest snapshot ou Playwright screenshot.

## Tokens requeridos (cleric/tokens/light.css)

```css
:root {
  --background: 230 18% 95%;
  --foreground: 232 45% 10%;
  --card: 230 20% 97%;
  --card-foreground: 232 45% 10%;
  --popover: 230 20% 97%;
  --popover-foreground: 232 45% 10%;
  --primary: 232 50% 18%;
  --primary-foreground: 0 0% 98%;
  --secondary: 230 15% 93%;
  --secondary-foreground: 232 50% 18%;
  --muted: 230 15% 93%;
  --muted-foreground: 232 12% 44%;
  --accent: 172 66% 30%;
  --accent-foreground: 0 0% 98%;
  --warning: 23 90% 52%;
  --warning-foreground: 0 0% 100%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 98%;
  --success: 160 84% 39%;
  --success-foreground: 0 0% 98%;
  --border: 230 15% 87%;
  --input: 230 15% 87%;
  --ring: 172 66% 30%;
  --chart-1: 172 66% 30%;
  --chart-2: 232 50% 45%;
  --chart-3: 43 96% 56%;
  --chart-4: 280 65% 60%;
  --chart-5: 0 72% 51%;
  --radius: 0.625rem;
}
```

## Tokens requeridos (cleric/tokens/dark.css)

```css
.dark {
  --background: 232 35% 6%;
  --foreground: 210 40% 96%;
  --card: 232 30% 10%;
  --card-foreground: 210 40% 96%;
  --popover: 232 30% 10%;
  --popover-foreground: 210 40% 96%;
  --primary: 172 66% 50%;
  --primary-foreground: 232 35% 6%;
  --secondary: 232 25% 16%;
  --secondary-foreground: 210 40% 96%;
  --muted: 232 25% 16%;
  --muted-foreground: 232 12% 68%;
  --accent: 172 66% 50%;
  --accent-foreground: 232 35% 6%;
  --warning: 23 90% 58%;
  --warning-foreground: 0 0% 100%;
  --destructive: 0 63% 51%;
  --destructive-foreground: 210 40% 96%;
  --success: 160 84% 42%;
  --success-foreground: 210 40% 96%;
  --border: 232 25% 18%;
  --input: 232 25% 18%;
  --ring: 172 66% 50%;
  --chart-1: 172 66% 50%;
  --chart-2: 232 50% 65%;
  --chart-3: 43 96% 66%;
  --chart-4: 280 65% 70%;
  --chart-5: 0 72% 61%;
}
```

## File Boundaries

### files_to_create
- `packages/ui/src/themes/cleric/entry.css`
- `packages/ui/src/themes/cleric/tokens/light.css`
- `packages/ui/src/themes/cleric/tokens/dark.css`
- `packages/ui/src/themes/cleric/README.md` (rationale + token source = `causeflow-new-home.html`)
- `packages/ui/src/components/__tests__/tokens-smoke.test.tsx` (smoke test)

### files_to_modify
- `packages/ui/src/themes/entry.css` (import cleric + set default)
- `packages/ui/src/themes/shared/base.css` (add `--warning` / `--success` no `@theme` block se ausentes; font-family stacks)
- `packages/ui/src/themes/config.json` (se existir, adicionar `cleric` à lista)
- `apps/dashboard/src/app/[locale]/globals.css` (ajuste de imports apenas; website não tem globals.css — importa `@causeflow/ui/styles` via layout)
- `apps/website/src/app/[locale]/layout.tsx` (se precisar ajustar import de CSS)

### files_read_only
- `/root/projects/causeflow/causeflow-new-home.html`
- `packages/ui/src/themes/original/tokens/{light,dark}.css`
- `packages/ui/src/themes/original/fonts/font-stacks.css`
- `packages/ui/src/themes/shared/base.css`
- `packages/ui/src/themes/THEMES.md`
- `apps/website/src/app/[locale]/layout.tsx`
- `apps/dashboard/src/app/[locale]/layout.tsx`

### shared_contracts
- Nenhum contrato novo — apenas publicação de tokens que outras sprints consomem.

## Acceptance Criteria

- [ ] `rg -n "\-\-(primary|accent|warning|success|background):" packages/ui/src/themes/cleric/tokens/light.css` retorna todas as declarações esperadas.
- [ ] `pnpm --filter @causeflow/ui build` passa sem erro.
- [ ] `pnpm --filter @causeflow/ui test` (se existir suíte) passa — smoke test novo incluso.
- [ ] `pnpm exec biome check packages/ui` verde.
- [ ] Em dev (`pnpm --filter @causeflow/website dev --hostname localhost`), `document.documentElement` exibe `--primary: 232 50% 18%` e `--accent: 172 66% 30%` via DevTools.
- [ ] Computed `font-family` em `body` inclui "Plus Jakarta Sans".
- [ ] Utilitários `bg-warning`, `bg-success`, `bg-accent`, `font-display` renderizam cores/fonte correspondentes no smoke component.

## Verification

```bash
pkill -f 'next-server|next start|next dev' 2>/dev/null
pnpm --filter @causeflow/ui build
pnpm --filter @causeflow/ui test
pnpm exec biome check packages/ui
pnpm --filter @causeflow/website dev --hostname localhost &
sleep 8
curl -sS http://localhost:3000 > /dev/null && echo "website OK"
```

Playwright smoke (criar em `tests/e2e/design-system/tokens.spec.ts`):
- navegar `http://localhost:3000`
- `page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary'))` → match `232 50% 18%`
- `page.evaluate(() => getComputedStyle(document.body).fontFamily)` → contém `Plus Jakarta Sans`

## Risks (sprint-level)

- **Tailwind v4 @theme block:** variáveis precisam estar no formato `<h> <s>% <l>%` sem wrapper. Se sprint-executor escrever `hsl(...)` wrapped, Tailwind não gera utilitário — dump de cor branca. Verificar uma cor manualmente via DevTools antes de fechar sprint.
- **Google Fonts em PRoot:** se o projeto hoje self-hospeda fontes em `themes/original/fonts/files/`, copiar a mesma abordagem para cleric (self-host `.woff2`) — evita fetch externo em build.

## Notes for executor

- Se `--warning` / `--success` já existirem em `shared/base.css`, apenas confirme e não duplique.
- Mantenha `original/` 100% intacto — nenhum arquivo lá dentro é modificado.
- README do cleric deve citar: "tokens espelhados de `/root/projects/causeflow/causeflow-new-home.html` (linha 1–N se inline, ou grep HSL values)" + link para THEMES.md.
- Se `config.json` define `defaultThemeId`, alterar para `"cleric"`.
