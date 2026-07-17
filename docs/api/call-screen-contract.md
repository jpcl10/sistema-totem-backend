# Call Screen Contract

## Arquitetura

A Tela de Chamada publica usa um contexto explicito:

```ts
type CallScreenContext =
  | { type: 'STORE'; storeId: string }
  | { type: 'EVENT'; eventId: string }
```

Fontes nativas:

- `STORE`: `OnlineOrder`
- `EVENT`: `Order`

Nao existe terceira tabela de pedidos e `Order`/`OnlineOrder` nao sao fundidos.

## Rotas

Bootstrap completo:

- `GET /public/call-screens/store/:slug`
- `GET /public/call-screens/event/:slug`

Polling leve:

- `GET /public/call-screens/store/:slug/orders`
- `GET /public/call-screens/event/:slug/orders`

Compatibilidade legada de evento:

- `GET /public/events/:slug/call-screen-orders`
- `GET /public/events/:slug/orders`

As rotas legadas delegam ao contrato seguro de evento.

## DTO publico

```json
{
  "id": "store-12",
  "publicCode": "#12",
  "orderNumber": 12,
  "status": "PREPARING",
  "statusLabel": "Em preparo",
  "fulfillmentType": "PICKUP",
  "displayName": "Joao",
  "updatedAt": "2026-07-16T12:00:00.000Z",
  "readyAt": null
}
```

Privacidade:

- `displayName` usa somente o primeiro nome.
- `id` do pedido e sintetico, sem CUID nativo.
- Nao retorna telefone.
- Nao retorna endereco, numero, bairro ou complemento.
- Nao retorna pagamento.
- Nao retorna valores.
- Nao retorna observacoes.
- Nao retorna `customerId`.
- Nao retorna items/options.

## Status

Status publicos:

- `PREPARING`
- `READY`

Mapeamento `OnlineOrder`:

- `CONFIRMED`, `PREPARING` -> `PREPARING`
- `READY` -> `READY`

Mapeamento `Order`:

- `CONFIRMED`, `PREPARING` -> `PREPARING`
- `READY` -> `READY`

Nao entram:

- `RECEIVED`
- `OUT_FOR_DELIVERY`
- `DELIVERED`
- `CANCELLED`

## Regras de loja

Contexto `STORE`:

- Resolve `OnlineStore` por `slug`.
- Loja precisa estar `active = true`.
- Consulta apenas `OnlineOrder.storeId` do contexto.
- Tenant e garantido por `store.organizationId`.
- `DELIVERY` nao aparece.
- Fulfillment permitido:
  - `PICKUP`
  - `COUNTER`
  - `DINE_IN` como `ON_SITE`

## Regras de evento

Contexto `EVENT`:

- Resolve `Event` por `slug`.
- Evento precisa estar `active = true`.
- Consulta apenas `Order.eventId` do contexto.
- Tenant e garantido por `event.organizationId`.
- Mantem compatibilidade: pedido precisa ter `paymentStatus` `PAID` ou `NOT_REQUIRED`.

## Branding e configuracao

Branding usa `SettingsResolverService`:

- loja: canal `DIGITAL_MENU`
- evento: canal `TOTEM`

Configuracao atual:

```json
{
  "showPreparing": true,
  "showReady": true,
  "soundEnabled": true,
  "maxItemsPerColumn": 10,
  "nameMasking": "FIRST_NAME_ONLY",
  "readyRetentionMinutes": null
}
```

Pendencia: ainda nao existe Settings centralizado especifico de Call Screen para som, colunas, permanencia e mascaramento. Hoje esses valores sao defaults documentados.

## Socket.IO

Rooms publicas:

- `call-screen:store:<storeId>`
- `call-screen:event:<eventId>`

Eventos de join no cliente:

- `join-call-screen-store` com `slug`
- `join-call-screen-event` com `slug`

Evento emitido pelo backend:

```json
{
  "event": "call-screen-refresh",
  "payload": {
    "context": {
      "type": "STORE",
      "id": "..."
    },
    "serverTime": "2026-07-16T22:30:37.000Z"
  }
}
```

O socket nao envia pedido completo. O frontend deve refazer polling do endpoint de orders/bootstrap.

## Polling

Usar:

- `GET /public/call-screens/store/:slug/orders`
- `GET /public/call-screens/event/:slug/orders`

Intervalo sugerido quando Socket.IO estiver indisponivel: 10 a 20 segundos.

## Exemplo STORE real

`GET /public/call-screens/store/guellos-pizza`

```json
{
  "context": {
    "type": "STORE",
    "id": "cmra0xven000xvwashub9xwug",
    "slug": "guellos-pizza",
    "name": "Guello's Pizza"
  },
  "branding": {
    "logoUrl": "https://pub-701e0de26e674838805d8d37e0635cdc.r2.dev/organizations/cmra0xvea000rvwasonliufxu/assets/generic/v1/8b2f54240b7a-a8ca0955-893e-4454-9d62-12e38ba92b1f.webp",
    "primaryColor": "#EA580C",
    "secondaryColor": "#0F172A",
    "backgroundColor": "#FFFFFF",
    "textColor": null
  },
  "configuration": {
    "showPreparing": true,
    "showReady": true,
    "soundEnabled": true,
    "maxItemsPerColumn": 10,
    "nameMasking": "FIRST_NAME_ONLY",
    "readyRetentionMinutes": null
  },
  "orders": {
    "preparing": [],
    "ready": []
  },
  "serverTime": "2026-07-16T22:30:37.708Z"
}
```

## Exemplo EVENT real

`GET /public/call-screens/event/joao-pedro-cardoso-lopes`

```json
{
  "context": {
    "type": "EVENT",
    "id": "cmrgkw4ev0001vwg89j5y35mz",
    "slug": "joao-pedro-cardoso-lopes",
    "name": "JOAO PEDRO CARDOSO LOPES"
  },
  "branding": {
    "logoUrl": "https://pub-701e0de26e674838805d8d37e0635cdc.r2.dev/organizations/cmra0xvea000rvwasonliufxu/assets/generic/v1/8b2f54240b7a-a8ca0955-893e-4454-9d62-12e38ba92b1f.webp",
    "primaryColor": "#6366f1",
    "secondaryColor": "#a855f7",
    "backgroundColor": "#FFFFFF",
    "textColor": null
  },
  "configuration": {
    "showPreparing": true,
    "showReady": true,
    "soundEnabled": true,
    "maxItemsPerColumn": 10,
    "nameMasking": "FIRST_NAME_ONLY",
    "readyRetentionMinutes": null
  },
  "orders": {
    "preparing": [],
    "ready": []
  },
  "serverTime": "2026-07-16T22:30:37.722Z"
}
```
