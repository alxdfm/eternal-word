# Decisão: Sincronização blockchain → banco em três camadas

**Data:** 2026-07-18
**Status:** aceita (Alexandre, 2026-07-18)
**Autor:** Claude (especificando o requisito do Alexandre: "dado fresco e confiável com o que tem na blockchain")

---

## Contexto

O banco é um espelho do estado on-chain para exibição (registrados, o que
falta, quem registrou). Isso exige duas garantias distintas: **frescor**
(novos registros aparecem no sistema em segundos, inclusive os feitos fora
do site — o programa é permissionless) e **confiabilidade** (o banco nunca
afirma um registro que não está na chain, e diverge dela no máximo
temporariamente).

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Frontend confirma a própria transação e grava REGISTERED | Simples | Banco "confia" no cliente — dado forjável; ignora registros feitos fora do site |
| Polling de `getProgramAccounts` | Simples, completo | Caro e lento em mainnet como mecanismo primário; frescor de minutos |
| Três camadas: evento + estado transitório + reconciliação — a escolhida | Frescor de segundos; nunca REGISTERED sem estar on-chain; auto-corrige perdas de evento e reorgs | Três mecanismos para manter |

---

## Decisão tomada

> **Evento em tempo real + PENDING otimista + reconciliação periódica**

**1. Frescor — evento em tempo real.** Webhook (Helius) ou `logsSubscribe`
no programa: cada `register_verse` confirmado dispara o indexer, que grava
`REGISTERED` + `adopter` + `transaction` + `slot` + `registered_at`.
Captura também registros feitos diretamente no programa, sem o site.

**2. UX — PENDING otimista.** Quando o registro parte do site, a API marca
`PENDING` ao enviar a transação. A promoção para `REGISTERED` vem **somente
pelo indexer** (camada 1 ou 3) — nunca pelo frontend. `PENDING` que expira
sem confirmação vira `FAILED` e volta a `AVAILABLE` na reconciliação.

**3. Confiabilidade — reconciliação periódica.** Job agendado compara o
conjunto completo de contas do programa (`getProgramAccounts`) com o banco:
corrige eventos perdidos (webhook fora do ar), desfaz efeitos de reorg
(usando `slot`) e destrava PENDINGs órfãos. A blockchain é a fonte da
verdade: qualquer divergência resolve a favor dela.

---

## Consequências

**Positivas:**
- Dashboard e perfis servidos por queries baratas no Postgres, com dado
  fresco (segundos) e auditável
- Estado do banco é sempre reconstruível do zero: seed (Catálogo) +
  varredura completa (Registro) — princípio do indexador aberto
- `REGISTERED` no banco implica conta existente on-chain, por construção

**Negativas / Trade-offs:**
- Dependência de provider de webhook (mitigada pela camada 3, que funciona
  sozinha em modo degradado)
- Janela de inconsistência possível entre evento e reconciliação (aceitável
  para exibição; a duplicidade real é impedida pela PDA, não pelo banco)

**Impacto no código:**
- `apps/api` (indexer: handler de webhook + job de reconciliação)
- `packages/application` (casos de uso de sincronização)

---

## Revisão futura

Revisitar o intervalo de reconciliação e o provider de webhook no deploy em
mainnet; avaliar `logsSubscribe` próprio se o custo do provider pesar.
