# Decisão: Nenhum limite de registro por carteira

**Data:** 2026-07-19
**Status:** aceita
**Autor:** Alexandre ("Se alguém se sentir confortável em registrar a bíblia inteira, que Deus o abençoe. Isso não é um problema.")

---

## Contexto

Ao revisar se alguém poderia corromper os dados chamando o programa por
fora da plataforma, ficou claro que o texto é inviolável (validação Merkle),
mas que nada impede uma única carteira de registrar os 31.098 versículos —
cerca de 68 SOL. Isso não corrompe dado nenhum, porém esvaziaria o caráter
coletivo do projeto. Era preciso decidir se o protocolo deveria resistir a
isso.

---

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Limite de versículos por carteira | Força distribuição aparente | Trivialmente contornável com várias carteiras; adiciona estado e complexidade a um programa que precisa ser simples e imutável; pune quem quer contribuir mais |
| Liberação gradual (por livro, em janelas) | Distribui no tempo | Atrasa o objetivo principal; introduz autoridade e cronograma num protocolo permissionless |
| Sem limite — a escolhida | Programa permanece mínimo; qualquer contribuição aproxima a meta; permissionless de verdade | O registro pode se concentrar em poucas carteiras |

---

## Decisão tomada

> **Nenhum limite. Quem quiser registrar, registra — inclusive tudo.**

O objetivo do Eternal Word é a Bíblia inteira registrada de forma permanente
e verificável. O financiamento distribuído é o **meio** que torna isso
viável sem depender de um patrocinador único — não é um fim em si. Se
alguém custear muitos versículos, ou todos, a meta do projeto é atingida
mais cedo, com o mesmo texto imutável e o mesmo registro público de quem
pagou por cada um.

Vale notar que o limite por carteira seria, além de tudo, teatro: qualquer
pessoa cria quantas carteiras quiser. A restrição daria aparência de
distribuição sem garantir nada, ao custo de estado extra num programa que
precisa ser simples porque será imutável.

---

## Consequências

**Positivas:**
- Programa mais simples: sem contadores, sem estado por carteira, sem
  autoridade decidindo quem pode registrar o quê
- Risco R6 do ROADMAP encerrado — não bloqueia o go-live
- Nenhuma barreira para quem quer contribuir mais

**Negativas / Trade-offs:**
- O registro pode se concentrar; o dashboard e o ranking de adopters podem
  refletir poucas carteiras. Aceito conscientemente.

**Impacto no código:**
- Nenhum: é a ausência de restrição. `register_verse` não ganha verificação
  de cota nem de identidade.

---

## Revisão futura

Nenhuma prevista. Voltaria à mesa apenas se a mecânica de marcos (badges,
NFTs comemorativos — backlog S08+) criar incentivo perverso que valha
tratar *naquela* funcionalidade, nunca no registro em si.
