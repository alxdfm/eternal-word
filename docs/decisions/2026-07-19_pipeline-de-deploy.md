# Decisão: Deploy por release do GitHub, com o programa Solana fora da pipeline

**Data:** 2026-07-19
**Status:** aceita
**Autor:** Alexandre ("crie uma pipeline para deployar a cada release do github") / Claude (recorte do que entra na automação)

---

## Contexto

O projeto precisa de entrega contínua, mas tem duas naturezas de artefato
muito diferentes: aplicação (web e API), que se redeploya à vontade, e o
programa Solana, cujo deploy em mainnet é **irreversível** e cria contas
permanentes. Tratar os dois com a mesma automação seria perigoso.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Deploy a cada push em `main` | Máxima frequência | Publica trabalho não finalizado; sem ponto de corte claro para auditar o que está em produção |
| Deploy só manual | Controle total | Passo repetitivo e sujeito a erro humano; contradiz entrega contínua |
| Release do GitHub dispara app; programa fora — a escolhida | Ponto de corte explícito e versionado; rollback = republicar tag anterior; o irreversível continua deliberado | Exige o ritual de criar release |

---

## Decisão tomada

> **`release: published` deploya web e API; o programa Solana nunca.**

**O que a pipeline faz** (`.github/workflows/release.yml`):
1. Faz checkout **da tag da release**, não do topo da branch — vai para
   produção exatamente o que foi marcado.
2. Reexecuta typecheck, lint e testes na tag antes de qualquer deploy. Uma
   release pode ter sido criada de um commit que não passou pelo CI.
3. Deploya `apps/web` (Vercel) e `apps/api` + indexer (AWS via OIDC, sem
   chave de longa duração no repositório), ambos com `environment:
   production` — permite exigir aprovação manual nas configurações do repo.

**O que a pipeline não faz:** deploy do programa Anchor. Publicar bytecode
em mainnet é permanente e afeta contas de terceiros; fica com runbook manual
próprio (S07/`GL`), com verificação de hash de bytecode e conferência do
Program ID. Automatizar isso trocaria segurança por conveniência num passo
que acontece pouquíssimas vezes na vida do projeto.

**CI separado** (`.github/workflows/ci.yml`) roda em push e PR, incluindo um
job de **integridade do CanonicalText** (66 / 1.189 / 31.098 e as 5 posições
omitidas) que já funciona hoje, antes do workspace existir, e passa a
verificar também a reprodutibilidade da Merkle root a partir da S01 (CT-05).

**Enquanto o código não existe**, os jobs detectam a ausência de
`pnpm-workspace.yaml` / `apps/*` e pulam com aviso, em vez de falhar ou
simular sucesso. Cada um se ativa sozinho quando a sprint correspondente
entregar seu artefato.

---

## Consequências

**Positivas:**
- Produção sempre corresponde a uma tag auditável; rollback é republicar
- Pipeline nasce antes do código e vai ativando por etapa
- O passo irreversível permanece humano e deliberado

**Negativas / Trade-offs:**
- Deploy exige criar release (ritual a mais)
- Secrets e role de OIDC precisam existir antes do primeiro deploy real —
  parte do provisionamento de infra, planejado para depois do
  desenvolvimento (ver S01/FD-10)

**Impacto no código:**
- `.github/workflows/ci.yml` e `.github/workflows/release.yml`
- Comando de deploy da API é placeholder até a ferramenta ser definida (S03)

---

## Revisão futura

Revisitar ao definir a ferramenta de deploy da API (S03) e ao escrever o
runbook de mainnet (S07). Avaliar ambiente de staging quando houver
necessidade de validar release antes de produção.
