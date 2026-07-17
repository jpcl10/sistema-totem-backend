# Financial Orders Contract

## Tabela financeira

Path:

`GET /orders/unified`

Autenticacao:

- `Authorization: Bearer <token>`
- tenant via `requireTenantContext`
- `SUPER_ADMIN` deve informar tenant efetivo via `x-organization-id`

## Query params

| Nome | Tipo | Obrigatorio | Valores validos | Default |
| --- | --- | --- | --- | --- |
| `page` | number inteiro positivo | nao | `>= 1` | `1` |
| `limit` | number inteiro positivo | nao | `1..100` | `50` |
| `search` | string | nao | qualquer string nao vazia | ausente |
| `origin` | string | nao | `ONLINE`, `TOTEM`, `EVENT`, `POS`, `COMANDA`, `QR_MESA`, `GARCOM_MOBILE`, `API`, `WHATSAPP`; `ALL` vira ausente | ausente |
| `sourceType` | string | nao | `EVENT`, `ONLINE`; `ALL` vira ausente | ausente |
| `source` | string | nao | `EVENT`, `TOTEM`, `MANUAL_EVENT`, `ONLINE_STORE`, `MANUAL_STORE`, `DIGITAL_MENU`, `POS`, `API`, `WHATSAPP`; `ALL` vira ausente | ausente |
| `orderType` | string | nao | `EVENT_ORDER`, `ONLINE_ORDER` | ausente |
| `status` | string | nao | `NEW`, `CONFIRMED`, `PREPARING`, `READY`, `OUT_FOR_DELIVERY`, `COMPLETED`, `CANCELLED`; aliases: `RECEIVED -> NEW`, `DELIVERED -> COMPLETED` | ausente |
| `paymentStatus` | string | nao | `NOT_REQUIRED`, `PENDING`, `PAID`, `FAILED`, `CANCELLED`, `REFUNDED` | ausente |
| `paymentMethod` | string | nao | `PIX_MANUAL`, `PIX_AUTOMATIC`, `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `COURTESY`, `NFC_BALANCE`, `OTHER`, `PIX`, `CARD_ON_DELIVERY` | ausente |
| `fulfillmentType` | string | nao | `DELIVERY`, `PICKUP`, `COUNTER`, `DINE_IN` | ausente |
| `dateField` | string | nao | `createdAt`, `paidAt` | `createdAt` |
| `startDate` | string Date parseavel por `Date` | nao | ISO recomendado | ausente |
| `endDate` | string Date parseavel por `Date` | nao | ISO recomendado | ausente |
| `eventId` | string | nao | string nao vazia | ausente |
| `storeId` | string | nao | string nao vazia | ausente |
| `customerId` | string | nao | string nao vazia | ausente |
| `sortBy` | string | nao | `createdAt`, `paidAt`, `totalInCents`, `orderNumber` | `createdAt` |
| `sortOrder` | string | nao | `asc`, `desc` | `desc` |

Nao suportado por esta rota:

- `pageSize`
- labels visuais de metodo de pagamento, como `PIX`, para evento quando o enum tecnico e `PIX_MANUAL` ou `PIX_AUTOMATIC`

## Regras de compatibilidade

- `orderType=EVENT_ORDER` carrega somente `Order`.
- `orderType=ONLINE_ORDER` carrega somente `OnlineOrder`.
- `sourceType=EVENT` equivale ao dominio de `EVENT_ORDER`.
- `sourceType=ONLINE` equivale ao dominio de `ONLINE_ORDER`.
- Se `orderType` e `sourceType` forem conflitantes, o resultado e vazio.
- `origin` preserva o contrato legado visual do `UnifiedOrderDTO`.
- `source` filtra a origem nativa/canal financeiro:
  - `EVENT`, `TOTEM`, `MANUAL_EVENT`, `POS` aplicam em `Order`.
  - `ONLINE_STORE`, `DIGITAL_MENU`, `MANUAL_STORE`, `POS`, `API`, `WHATSAPP` aplicam em `OnlineOrder`.
- `paymentMethod` aceita somente valores tecnicos dos enums reais:
  - `Order`: `PIX_MANUAL`, `PIX_AUTOMATIC`, `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `COURTESY`, `NFC_BALANCE`, `OTHER`.
  - `OnlineOrder`: `PIX`, `CARD_ON_DELIVERY`, `CASH`.
  - Se o metodo existir somente no outro dominio, aquele dominio nao e consultado.
- `startDate` e `endDate` filtram o campo definido em `dateField`.
- `dateField=createdAt` e a visao operacional.
- `dateField=paidAt` e a visao financeira por data de pagamento.
- Ordenacao padrao: `createdAt desc`.

## Paginacao e summary

- Filtros sao aplicados no Prisma antes de merge, ordenacao e paginacao.
- `pagination.total` e a soma dos `count` filtrados de `Order` e `OnlineOrder`.
- `summary.total`, `summary.origins` e `summary.statuses` usam os mesmos filtros da listagem.
- O backend busca uma janela por dominio de `page * limit`, faz merge ordenado e retorna a pagina solicitada.

## Exemplo

Request:

`GET /orders/unified?page=1&limit=1&orderType=ONLINE_ORDER&paymentStatus=PAID&paymentMethod=PIX&fulfillmentType=DELIVERY&dateField=paidAt&startDate=2026-07-16T03:00:00.000Z&endDate=2026-07-17T02:59:59.999Z&sortBy=paidAt&sortOrder=desc`

Response real local:

```json
{
  "data": [
    {
      "id": "cmro11ifx0001vwh08zfqskwv",
      "nativeId": "cmro11ifx0001vwh08zfqskwv",
      "orderType": "ONLINE_ORDER",
      "sourceType": "ONLINE",
      "origin": "ONLINE",
      "originLabel": "Online",
      "originIcon": "shopping-bag",
      "channel": "DIGITAL_MENU",
      "organizationId": "cmra0xvea000rvwasonliufxu",
      "eventId": null,
      "eventName": null,
      "storeId": "cmra0xven000xvwashub9xwug",
      "storeName": "Guello's Pizza",
      "orderNumber": 12,
      "status": "OUT_FOR_DELIVERY",
      "rawStatus": "OUT_FOR_DELIVERY",
      "fulfillment": "DELIVERY",
      "fulfillmentDetails": {
        "type": "DELIVERY",
        "address": {
          "address": "Francisco Pereira Franca",
          "number": "671",
          "neighborhood": "Centro",
          "complement": null,
          "reference": null
        },
        "deliveryFeeInCents": 0,
        "estimatedMinutes": 45,
        "deliveryRuleId": null
      },
      "customer": {
        "id": "cmrjasyc40001vwkkdbte098x",
        "name": "Joao Pedro",
        "phone": "15996921244"
      },
      "delivery": {
        "address": "Francisco Pereira Franca",
        "number": "671",
        "neighborhood": "Centro",
        "complement": null,
        "reference": null
      },
      "totals": {
        "subtotalInCents": 7000,
        "deliveryFeeInCents": 0,
        "totalInCents": 7000
      },
      "payment": {
        "status": "PAID",
        "method": "PIX",
        "paidAt": "2026-07-16T21:40:40.349Z",
        "transactionCount": 0
      },
      "items": [
        {
          "id": "cmro11ifx0003vwh0b9m6la5s",
          "catalogProductId": "cmrghp3uy000dvwsc054sbei9",
          "productName": "Portuguesa",
          "quantity": 1,
          "unitPriceInCents": 7000,
          "totalInCents": 7000,
          "notes": null,
          "options": [
            {
              "groupName": "Escolha o tamanho",
              "optionName": "M (8 pedaços)",
              "priceDeltaInCents": 3000
            },
            {
              "groupName": "Escolha a borda",
              "optionName": "Borda recheada",
              "priceDeltaInCents": 1000
            }
          ]
        }
      ],
      "printing": {
        "enabled": false,
        "jobsCount": 0,
        "pendingCount": 0,
        "errorCount": 0
      },
      "actionEndpoints": {
        "status": "/online-orders/cmro11ifx0001vwh08zfqskwv/status",
        "payment": "/orders/unified/ONLINE_ORDER/cmro11ifx0001vwh08zfqskwv/payment"
      },
      "createdAt": "2026-07-16T21:34:31.581Z",
      "updatedAt": "2026-07-16T21:41:16.657Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 1,
    "total": 10,
    "totalPages": 10
  },
  "summary": {
    "total": 10,
    "origins": {
      "ONLINE": 10
    },
    "statuses": {
      "NEW": 1,
      "CONFIRMED": 4,
      "OUT_FOR_DELIVERY": 2,
      "COMPLETED": 3
    }
  }
}
```

## Cards financeiros

Path:

`GET /financial-summary`

Query params:

- `period`: `EVENT`, `TODAY`, `24H`, `7D`, `CUSTOM`; default `TODAY`
- `startDate`
- `endDate`
- `storeId`
- `eventId`
- `source`: `EVENT`, `TOTEM`, `MANUAL_EVENT`, `ONLINE_STORE`, `MANUAL_STORE`, `DIGITAL_MENU`, `POS`, `API`, `WHATSAPP`
- `orderType`: `EVENT_ORDER`, `ONLINE_ORDER`
- `paymentMethod`
- `paymentStatus`
- `fulfillmentType`: `DELIVERY`, `PICKUP`, `COUNTER`, `DINE_IN`

Os cards usam `FinancialAggregationService`. A tabela usa `ListUnifiedOrdersService`; ambos consultam `Order` e `OnlineOrder`, mas por services diferentes.
