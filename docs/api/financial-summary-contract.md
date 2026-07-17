# Financial Summary Contract

## Endpoint

`GET /financial-summary`

Endpoint legado que usa a mesma camada:

`GET /events/:eventId/financial-summary`

## Timezone oficial

Fonte oficial:

1. `OrganizationSettings.timezone`
2. fallback `America/Sao_Paulo`

O frontend pode ler o timezone em endpoints existentes de Settings:

`GET /settings/effective`

```json
{
  "effective": {
    "general": {
      "timezone": {
        "value": "America/Sao_Paulo",
        "source": "DEFAULT"
      }
    }
  }
}
```

`GET /settings` tambem inclui:

```json
{
  "settings": {
    "general": {
      "timezone": {
        "value": "America/Sao_Paulo",
        "source": "DEFAULT"
      }
    }
  }
}
```

O resumo financeiro sempre retorna o timezone efetivamente usado em:

`summary.period.timezone`

## Query params

| Nome | Tipo | Obrigatorio | Valores validos | Default |
| --- | --- | --- | --- | --- |
| `period` | string | nao | `EVENT`, `TODAY`, `YESTERDAY`, `24H`, `7D`, `LAST_7_DAYS`, `LAST_30_DAYS`, `CUSTOM` | `TODAY` |
| `startDate` | string | somente para `CUSTOM` | data local no timezone da organizacao | ausente |
| `endDate` | string | somente para `CUSTOM` | data local no timezone da organizacao | ausente |
| `storeId` | string | nao | loja do tenant | ausente |
| `eventId` | string | nao | evento do tenant | ausente |
| `source` | string | nao | `EVENT`, `TOTEM`, `MANUAL_EVENT`, `ONLINE_STORE`, `MANUAL_STORE`, `DIGITAL_MENU`, `POS`, `API`, `WHATSAPP` | ausente |
| `orderType` | string | nao | `EVENT_ORDER`, `ONLINE_ORDER` | ausente |
| `paymentMethod` | string | nao | valores tecnicos reais de `PaymentMethod` ou `OnlineOrderPaymentMethod` | ausente |
| `paymentStatus` | string | nao | `NOT_REQUIRED`, `PENDING`, `PAID`, `FAILED`, `CANCELLED`, `REFUNDED` | ausente |
| `fulfillmentType` | string | nao | `DELIVERY`, `PICKUP`, `COUNTER`, `DINE_IN` | ausente |

## Regras de receita

- Receita usa somente `paymentStatus = PAID`.
- Receita usa `paidAt` dentro do periodo.
- Pedido cancelado nao entra em receita.
- Valor oficial: `totalInCents`.
- Troco/valor recebido nao aumenta receita.
- Se `paymentStatus` for informado e for diferente de `PAID`, `grossRevenueInCents`, `paidOrdersCount` e `timeseries.points` ficam sem receita paga.

## Granularidade da timeseries

| Periodo | Granularidade |
| --- | --- |
| `TODAY` | `HOUR` |
| `YESTERDAY` | `HOUR` |
| `24H` | `HOUR` |
| `7D` | `DAY` |
| `LAST_7_DAYS` | `DAY` |
| `LAST_30_DAYS` | `DAY` |
| `CUSTOM` ate 2 dias | `HOUR` |
| `CUSTOM` ate 90 dias | `DAY` |
| `CUSTOM` maior que 90 dias | `MONTH` |
| `EVENT` sem range | `DAY`, com `points: []` |

## Shape da timeseries

```json
{
  "timeseries": {
    "granularity": "HOUR",
    "timezone": "America/Sao_Paulo",
    "dateField": "paidAt",
    "points": [
      {
        "periodStart": "2026-07-16T22:00:00.000Z",
        "label": "19:00",
        "grossRevenueInCents": 33500,
        "paidOrdersCount": 5,
        "averageTicketInCents": 6700
      }
    ]
  }
}
```

- `periodStart` e ISO UTC do inicio real do bucket local.
- `label` e auxiliar; o frontend deve preferir `periodStart`.
- Pontos sao ordenados crescente.
- Buckets vazios aparecem com zero.
- `averageTicketInCents = grossRevenueInCents / paidOrdersCount`.
- Se `paidOrdersCount = 0`, `averageTicketInCents = 0`.

## Estrategia de agregacao

`FinancialAggregationService` usa SQL parametrizado com:

- `generate_series` para continuidade dos buckets;
- `date_trunc` para bucket;
- `AT TIME ZONE` com timezone IANA da organizacao;
- queries agregadas para `Order` e `OnlineOrder`;
- merge por bucket no banco;
- filtros de tenant em todas as fontes.

Nao usa `UnifiedOrderDTO` e nao carrega todos os pedidos em memoria.

## Exemplo real

Request:

`GET /financial-summary?period=TODAY`

Response real local, recortado para manter o exemplo legivel:

```json
{
  "summary": {
    "period": {
      "type": "TODAY",
      "timezone": "America/Sao_Paulo",
      "startDate": "2026-07-16T03:00:00.000Z",
      "endDate": "2026-07-17T02:59:59.999Z",
      "revenueDateField": "paidAt",
      "operationalDateField": "createdAt"
    },
    "event": null,
    "store": null,
    "grossRevenueInCents": 67500,
    "netRevenueInCents": 67500,
    "deliveryFeesInCents": 0,
    "discountsInCents": 0,
    "refundsInCents": 0,
    "paidOrdersCount": 10,
    "pendingOrdersCount": 0,
    "canceledOrdersCount": 0,
    "refundedOrdersCount": 0,
    "averageTicketInCents": 6750,
    "byPaymentMethod": {
      "PIX": {
        "amountInCents": 67500,
        "ordersCount": 10,
        "methods": {
          "PIX": 67500
        }
      }
    },
    "bySource": {
      "EVENT": 0,
      "TOTEM": 0,
      "MANUAL_EVENT": 0,
      "DIGITAL_MENU": 52000,
      "MANUAL_STORE": 15500
    },
    "byOrderType": {
      "EVENT_ORDER": 0,
      "ONLINE_ORDER": 67500
    },
    "byFulfillmentType": {
      "ON_SITE": 0,
      "DELIVERY": 67500
    },
    "timeseries": {
      "granularity": "HOUR",
      "timezone": "America/Sao_Paulo",
      "dateField": "paidAt",
      "points": [
        {
          "periodStart": "2026-07-16T03:00:00.000Z",
          "label": "00:00",
          "grossRevenueInCents": 0,
          "paidOrdersCount": 0,
          "averageTicketInCents": 0
        },
        {
          "periodStart": "2026-07-16T22:00:00.000Z",
          "label": "19:00",
          "grossRevenueInCents": 33500,
          "paidOrdersCount": 5,
          "averageTicketInCents": 6700
        },
        {
          "periodStart": "2026-07-17T00:00:00.000Z",
          "label": "21:00",
          "grossRevenueInCents": 34000,
          "paidOrdersCount": 5,
          "averageTicketInCents": 6800
        }
      ]
    },
    "limitations": {
      "discounts": "No discount field exists in Order or OnlineOrder; reported as 0.",
      "netRevenue": "No payment fee/refund amount fields exist; net equals recognized paid order total.",
      "refunds": "Refund amount is inferred from totalInCents for orders with paymentStatus REFUNDED.",
      "eventOrderBreakdown": "Order does not store subtotal, delivery fee, discount, fulfillment type, or source; source is derived from device/paymentNotes."
    }
  }
}
```

Observacao: a resposta real retorna todos os buckets do periodo; o exemplo acima mostra apenas alguns pontos.
