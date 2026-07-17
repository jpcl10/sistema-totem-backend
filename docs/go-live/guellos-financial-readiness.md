# Go-Live Guellos - Financial Readiness V2

Data da auditoria: 2026-07-16

## 1. Arquitetura antiga

O Financeiro existente estava concentrado em:

- Rota: `GET /events/:eventId/financial-summary`
- Controller: `src/modules/orders/controllers/get-event-financial-summary-controller.ts`
- Service: `src/modules/orders/services/get-event-financial-summary-service.ts`
- Fonte consultada: somente `Order`
- Filtro temporal: `createdAt`
- Calculo: carregava pedidos em memoria via `findMany` e somava no Node
- Contrato legado: `grossTotalInCents`, `paidTotalInCents`, `pendingTotalInCents`, `cancelledTotalInCents`, `byPaymentMethod`

Tambem existia um resumo separado de loja:

- Rota: `GET /online-stores/:storeId/summary`
- Service: `src/modules/online-stores/services/get-online-store-summary-service.ts`
- Fonte consultada: somente `OnlineOrder`
- Problema: assumia pedidos do dia como receita sem exigir `paymentStatus = PAID`.

O `UnifiedOrderDTO` existe apenas para apresentacao da Central:

- Presenter: `src/modules/orders/presenters/unified-order-presenter.ts`
- Endpoint consumidor: `GET /orders/unified`

Ele nao foi usado como fonte financeira para evitar duplicidade.

## 2. Fonte oficial

- `EVENT_ORDER`: tabela `Order`
- `ONLINE_ORDER`: tabela `OnlineOrder`
- `UnifiedOrderDTO`: somente apresentacao/agregacao operacional

Foi criada a camada `FinancialAggregationService` para agregar `Order` e `OnlineOrder` sem criar terceira tabela e sem calcular receita a partir do DTO unificado.

## 3. Bugs encontrados

- `OnlineOrder` nao entrava no resumo financeiro de evento.
- O resumo de loja considerava todos os pedidos como receita do dia, independente de `paymentStatus`.
- O resumo de evento usava `createdAt` para receita, nao `paidAt`.
- O resumo de evento usava `amountPaidInCents` como receita paga; para dinheiro com troco isso poderia inflar receita.
- O resumo antigo carregava pedidos em memoria antes de somar.
- Timezone da organizacao nao era usado para dia operacional.

## 4. Duplicidades

Nao foi encontrada uma terceira tabela de pedidos.

Risco principal: somar `Order`/`OnlineOrder` a partir de `UnifiedOrderDTO` poderia duplicar se algum fluxo agregasse as mesmas fontes novamente. A nova camada agrega diretamente as tabelas oficiais e separa `byOrderType`.

## 5. Regras de receita

Receita reconhecida somente quando:

- `paymentStatus = PAID`
- pedido nao esta cancelado

Nao entram em receita:

- `PENDING`
- `FAILED`
- `CANCELLED`
- `REFUNDED`
- pedido com `status = CANCELLED`

Troco nao aumenta receita:

- `Order.amountPaidInCents` e `Order.changeForInCents` sao auditados, mas a receita usa `Order.totalInCents`.
- `OnlineOrder.changeForInCents` nao altera receita; a receita usa `OnlineOrder.totalInCents`.

Campos retornados no resumo agregado:

- `grossRevenueInCents`
- `netRevenueInCents`
- `deliveryFeesInCents`
- `discountsInCents`
- `refundsInCents`
- `paidOrdersCount`
- `pendingOrdersCount`
- `canceledOrdersCount`
- `refundedOrdersCount`
- `averageTicketInCents`
- `byPaymentMethod`
- `bySource`
- `byOrderType`
- `byFulfillmentType`
- `period`

## 6. Campos reais auditados

`Order`:

- Existe: `totalInCents`, `paymentStatus`, `paymentMethod`, `paidAt`, `cancelledAt`, `amountPaidInCents`, `changeForInCents`
- Nao existe: `subtotalInCents`, `deliveryFeeInCents`, `discountInCents`, `canceledAt`, `refundedAt`, `amountReceivedInCents`, `changeInCents`

`OnlineOrder`:

- Existe: `subtotalInCents`, `deliveryFeeInCents`, `totalInCents`, `paymentStatus`, `paymentMethod`, `paidAt`, `changeForInCents`, `source`, `fulfillmentType`
- Nao existe: `discountInCents`, `canceledAt`, `cancelledAt`, `refundedAt`, `amountReceivedInCents`, `changeInCents`

Nao foi criada migration porque nao ha necessidade comprovada para o P0.

## 7. Timezone

O resumo financeiro usa:

- `OrganizationSettings.timezone`
- fallback `America/Sao_Paulo`

Para `TODAY` e `CUSTOM`, as datas sao interpretadas no timezone da organizacao. Exemplo validado em teste:

- `2026-07-16` em `America/Sao_Paulo`
- inicio UTC: `2026-07-16T03:00:00.000Z`
- fim UTC: `2026-07-17T02:59:59.999Z`

Receita usa `paidAt`. Contadores operacionais de pendentes/cancelados usam `createdAt`.

## 8. Cancelamentos e estornos

Pedido pago e cancelado nao entra em receita porque a query de receita exige `status != CANCELLED`.

Nao existe modelo monetario de estorno parcial. Para `paymentStatus = REFUNDED`, `refundsInCents` infere o valor por `totalInCents`, e isso esta marcado como limitacao do contrato.

## 9. Metodos

Normalizacao visual:

- `PIX_MANUAL`, `PIX_AUTOMATIC`, `PIX` -> `PIX`
- `CREDIT_CARD`, `CARD_ON_DELIVERY` -> `CARD`
- `DEBIT_CARD` -> `DEBIT`
- `CASH` -> `CASH`
- `COURTESY` -> `COURTESY`
- `NFC_BALANCE` -> `NFC_BALANCE`
- demais -> `OTHER`

O valor tecnico original fica preservado em `byPaymentMethod[normalizado].methods`.

## 10. Endpoints

Novo endpoint agregado:

- `GET /financial-summary`
- Auth: `verifyJWT`, `requireTenantContext`
- Filtros: `period`, `startDate`, `endDate`, `storeId`, `eventId`, `source`, `orderType`, `paymentMethod`, `paymentStatus`, `fulfillmentType`

Endpoint legado mantido:

- `GET /events/:eventId/financial-summary`
- Agora usa `FinancialAggregationService`
- Mantem aliases legados como `paidOrders`, `pendingOrders`, `cancelledOrders`, `grossTotalInCents`, `paidTotalInCents`
- Inclui campos novos do resumo agregado

## 11. Seguranca e tenant

Todas as queries agregadas filtram por `organizationId` via relacao:

- `Order.event.organizationId`
- `OnlineOrder.store.organizationId`

Quando `eventId` ou `storeId` sao informados, a posse do tenant e validada antes da agregacao.

`SUPER_ADMIN` depende do `requireTenantContext`; portanto respeita a organizacao efetiva/impersonada.

## 12. Performance

O novo resumo evita `findMany` de pedidos para calcular receita.

Usa:

- `aggregate`
- `count`
- `groupBy`

Nao foram recomendados indices novos neste P0. Se o volume crescer, candidatos provaveis:

- `Order(eventId, paymentStatus, paidAt)`
- `OnlineOrder(storeId, paymentStatus, paidAt)`
- `OnlineOrder(source, fulfillmentType)`

## 13. Socket.IO

O fluxo de pagamento ja emite:

- `unified-order-updated`
- eventos especificos de `order-updated` ou `online-order-updated`

Nao foi criado evento novo. O financeiro deve consumir `unified-order-updated` ou manter polling no endpoint agregado como fallback.

## 14. Arquivos alterados

- `src/modules/orders/services/financial-aggregation-service.ts`
- `src/modules/orders/services/financial-aggregation-service.test.ts`
- `src/modules/orders/controllers/get-financial-summary-controller.ts`
- `src/modules/orders/services/get-event-financial-summary-service.ts`
- `src/modules/orders/routes/orders-routes.ts`
- `docs/go-live/guellos-financial-readiness.md`

## 15. Testes executados

- `npx.cmd tsc --noEmit`
- `node --import tsx --test src/modules/orders/services/financial-aggregation-service.test.ts`
- `npm.cmd test`
- `npx.cmd prisma validate`

Resultado:

- Typecheck: passou
- Testes especificos financeiros: passaram
- Suite completa: 36 testes passaram
- Prisma validate: passou

## 16. P0/P1/P2

P0 resolvido:

- Receita reconhecida somente por `PAID`.
- Pedido cancelado nao entra em receita.
- Troco nao entra em receita.
- `Order` e `OnlineOrder` entram no resumo agregado.
- Tenant obrigatorio em todas as queries financeiras.
- Timezone da organizacao aplicado em filtros diarios/customizados.
- Sem terceira tabela e sem uso financeiro do `UnifiedOrderDTO`.

P1:

- Corrigir `GetOnlineStoreSummaryService` ou migrar consumidores para `GET /financial-summary`.
- Adicionar filtros por metodo normalizado (`PIX`, `CARD`) alem dos metodos tecnicos.
- Criar contrato frontend formal para o dashboard financeiro.

P2:

- Modelar estorno parcial/total com valor real.
- Modelar taxas de pagamento.
- Modelar desconto em `Order`/`OnlineOrder`, se a regra comercial exigir.
- Adicionar indices apos medicao em producao.

## 17. Pronto para producao?

Status: pronto para Go-Live com ressalvas P1/P2 documentadas.

O resumo financeiro agregado esta pronto para producao no escopo P0. A maior ressalva e que desconto, taxa de pagamento e estorno parcial nao possuem base real no schema atual; por isso nao foram inventados.
