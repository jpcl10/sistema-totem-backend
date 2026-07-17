# ADR-004: Armazenamento de Pedidos vs Visao Unificada

Status: Accepted

Data: 2026-07-14

## Contexto

A plataforma possui dois modelos reais de pedidos:

- `Order`: pedidos de evento/totem/manual de evento.
- `OnlineOrder`: pedidos de loja online/operacao diaria.

A Central Operacional consome `GET /orders/unified`, que usa adapters/presenters para expor `UnifiedOrderDTO`.

## Opcoes Consideradas

| Opcao | Resultado |
| --- | --- |
| Fundir `Order` e `OnlineOrder` agora | Alto risco, migration historica complexa. |
| Criar terceira tabela unificada | Duplicaria dados e aumentaria inconsistencia. |
| Manter tabelas separadas e unificar por DTO | Preserva historico e reduz risco. |

## Decisao

`Order` e `OnlineOrder` permanecem separados. A unificacao pertence a camada de apresentacao/agregacao por `UnifiedOrderDTO`.

## Consequencias

- Nao criar uma terceira tabela de pedidos sem ADR e plano de migracao.
- Regras nativas de cada pedido continuam nos services existentes.
- A Central Operacional deve depender de adapters, nao de duplicacao de logica.

## Riscos

- Divergencias de status/source/fulfillment se o presenter nao for mantido.
- Socket.IO precisa emitir eventos unificados para ambos os modelos.
- Relatorios financeiros precisam explicitar se agregam ambos.

## Proximos Passos

- Manter contrato `UnifiedOrderDTO` documentado.
- Cobrir mapeamentos por testes.
- Evoluir fulfillment/payment/printing sem alterar storage historico.
