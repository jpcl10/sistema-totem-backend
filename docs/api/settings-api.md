# Settings API

Version: `1.1.0`  
Status: `APPROVED`  
Owner: `Backend`  
Last Updated: `2026-07-13`

Documento de consumo da API do Centro de Configuracoes. A arquitetura completa fica em `docs/architecture/settings-architecture.md`.

## Autenticacao e Tenant

Todas as rotas administrativas de settings usam:

- `verifyJWT`
- `requireTenantContext`

Headers esperados:

```http
Authorization: Bearer <token>
Content-Type: application/json
x-organization-id: <organizationId>
```

Observacoes:

- `SUPER_ADMIN` deve operar com contexto de organizacao efetivo.
- `ADMIN` e `OPERATOR` usam a organizacao do token/contexto.
- O agregador nao deve retornar secrets reais.

## Endpoints

| Metodo | Path | Status | Uso |
|---|---|---|---|
| `GET` | `/settings` | ativo | Agregado completo para o admin/frontend. |
| `GET` | `/settings/effective` | ativo | Configuracao resolvida por contexto. |
| `PATCH` | `/settings/general` | ativo | Atualiza configuracoes gerais da organizacao. |
| `GET` | `/settings/branding` | ativo | Retorna branding global e effective branding. |
| `PATCH` | `/settings/branding` | ativo | Atualiza branding global. |
| `GET` | `/settings/business-hours` | ativo | Lista horarios semanais e excecoes filtrados. |
| `PUT` | `/settings/business-hours` | ativo | Substitui horarios semanais de um contexto/canal. |
| `POST` | `/settings/business-hours/exceptions` | ativo | Cria excecao de horario. |
| `PATCH` | `/settings/business-hours/exceptions/:exceptionId` | ativo | Atualiza excecao de horario. |
| `DELETE` | `/settings/business-hours/exceptions/:exceptionId` | ativo | Remove excecao de horario. |
| `GET` | `/settings/online-orders?storeId=:storeId` | ativo | Retorna settings de pedidos online por loja. |
| `PATCH` | `/settings/online-orders?storeId=:storeId` | ativo | Atualiza settings de pedidos online por loja. |
| `GET` | `/settings/delivery?storeId=:storeId` | ativo | Retorna settings de delivery por loja. |
| `PATCH` | `/settings/delivery?storeId=:storeId` | ativo | Atualiza settings de delivery por loja. |
| `GET` | `/settings/delivery/rules?storeId=:storeId` | ativo | Lista regras de taxa de entrega. |
| `POST` | `/settings/delivery/rules` | ativo | Cria regra de taxa de entrega. |
| `PATCH` | `/settings/delivery/rules/:ruleId` | ativo | Atualiza regra de taxa de entrega. |
| `DELETE` | `/settings/delivery/rules/:ruleId` | ativo | Remove regra de taxa de entrega. |

## GET /settings

Retorna o agregado do Centro de Configuracoes para a organizacao efetiva.

### Query Params

| Param | Tipo | Obrigatorio | Observacao |
|---|---|---|---|
| `storeId` | `cuid` | nao | Usado para resolver contexto de loja. |
| `eventId` | `cuid` | nao | Usado para adapter legado de evento. |
| `deviceId` | `cuid` | nao | Usado para adapter legado de dispositivo. |
| `channel` | enum | nao | `ALL`, `DELIVERY`, `PICKUP`, `DIGITAL_MENU`, `TOTEM`, `COUNTER`. |
| `date` | date | nao | Data usada na resolucao efetiva. |

### Response

```json
{
  "version": 1,
  "updatedAt": "2026-07-13T00:00:00.000Z",
  "general": {
    "id": null,
    "organizationId": "org_123",
    "legalName": null,
    "document": null,
    "contactEmail": null,
    "contactPhone": null,
    "whatsapp": null,
    "address": null,
    "city": null,
    "state": null,
    "postalCode": null,
    "timezone": "America/Sao_Paulo",
    "locale": "pt-BR",
    "currency": "BRL",
    "createdAt": null,
    "updatedAt": null
  },
  "branding": null,
  "businessHours": {
    "weekly": [],
    "exceptions": []
  },
  "onlineOrders": {
    "settings": []
  },
  "delivery": {
    "settings": [],
    "rules": []
  },
  "payments": null,
  "printing": null,
  "production": null,
  "operation": null,
  "totem": null,
  "digitalMenu": null,
  "notifications": null,
  "integrations": null,
  "security": null,
  "modules": ["EVENTS", "ONLINE_ORDERS"],
  "permissions": {
    "general": true,
    "branding": true,
    "businessHours": true,
    "onlineOrders": true,
    "delivery": true,
    "payments": false,
    "printing": false,
    "production": true,
    "operation": true,
    "totem": false,
    "digitalMenu": true,
    "notifications": false,
    "integrations": true,
    "security": true,
    "audit": true
  },
  "capabilities": {
    "hasEvents": true,
    "hasOnlineOrders": true,
    "hasDelivery": false,
    "hasPayments": false,
    "hasPrinting": false,
    "hasTotem": false,
    "hasCashless": false,
    "hasDevices": false,
    "hasDigitalMenu": true,
    "hasWhatsApp": false
  },
  "existing": {
    "organization": {
      "id": "org_123",
      "name": "Organizacao Exemplo",
      "slug": "organizacao-exemplo",
      "createdAt": "2026-07-13T00:00:00.000Z",
      "updatedAt": "2026-07-13T00:00:00.000Z"
    },
    "onlineStores": [],
    "events": [],
    "payments": [],
    "printing": {
      "printers": [],
      "eventSettings": []
    },
    "devices": [],
    "modules": []
  },
  "sources": {
    "general": "DEFAULT",
    "branding": "DEFAULT",
    "onlineStores": "ONLINE_STORE",
    "events": "EVENT_LEGACY",
    "payments": "PAYMENT_PROVIDER_SETTINGS",
    "printing": "EVENT_LEGACY_DEVICE_EVENT_PRINTER",
    "devices": "DEVICE",
    "modules": "ORGANIZATION_MODULE",
    "permissions": "MODULE_CAPABILITY_POLICY",
    "capabilities": "MODULES_AND_EXISTING_DATA"
  },
  "effective": {}
}
```

Campos pessoais e dados sensiveis devem ser sanitizados em exemplos. O endpoint real pode retornar dados cadastrais da organizacao configurados pelo tenant.

## GET /settings/effective

Retorna configuracao ja resolvida para um contexto.

### Query Params

Mesmos de `GET /settings`.

### Response

```json
{
  "general": {
    "timezone": {
      "value": "America/Sao_Paulo",
      "source": "DEFAULT"
    },
    "locale": {
      "value": "pt-BR",
      "source": "DEFAULT"
    },
    "currency": {
      "value": "BRL",
      "source": "DEFAULT"
    }
  },
  "branding": {
    "logoUrl": {
      "value": null,
      "source": "DEFAULT"
    },
    "bannerUrl": {
      "value": null,
      "source": "DEFAULT"
    },
    "theme": {
      "value": "SYSTEM",
      "source": "DEFAULT"
    }
  },
  "businessHours": {
    "date": "2026-07-13T00:00:00.000Z",
    "channel": "ALL",
    "exception": null,
    "weeklyHours": [],
    "source": "DEFAULT",
    "manualOverride": null
  },
  "legacyAdapters": {
    "event": null,
    "device": null,
    "store": null
  }
}
```

## PATCH /settings/general

Atualiza configuracoes gerais da organizacao.

### Body

Todos os campos sao opcionais.

```json
{
  "legalName": "Empresa Exemplo LTDA",
  "document": "00.000.000/0001-00",
  "contactEmail": "contato@example.com",
  "contactPhone": "+55 11 99999-0000",
  "whatsapp": "+55 11 98888-0000",
  "address": "Rua Exemplo, 100",
  "city": "Sao Paulo",
  "state": "SP",
  "postalCode": "00000-000",
  "timezone": "America/Sao_Paulo",
  "locale": "pt-BR",
  "currency": "BRL"
}
```

### Validacoes

- `contactEmail` deve ser e-mail valido.
- `currency` deve ter 3 caracteres.
- Campos nullable podem receber `null`.

## GET /settings/branding

Retorna branding global persistido e branding efetivo.

### Response

```json
{
  "branding": {
    "id": "branding_123",
    "organizationId": "org_123",
    "logoUrl": "https://cdn.example.com/logo.webp",
    "lightLogoUrl": null,
    "darkLogoUrl": null,
    "faviconUrl": null,
    "bannerDesktopUrl": null,
    "bannerMobileUrl": null,
    "socialImageUrl": null,
    "primaryColor": "#111111",
    "secondaryColor": "#eeeeee",
    "backgroundColor": "#ffffff",
    "theme": "SYSTEM",
    "defaultProductImageUrl": null,
    "createdAt": "2026-07-13T00:00:00.000Z",
    "updatedAt": "2026-07-13T00:00:00.000Z"
  },
  "effective": {
    "logoUrl": {
      "value": "https://cdn.example.com/logo.webp",
      "source": "ORGANIZATION"
    }
  }
}
```

## PATCH /settings/branding

Atualiza branding global.

### Body

```json
{
  "logoUrl": "https://cdn.example.com/logo.webp",
  "lightLogoUrl": null,
  "darkLogoUrl": null,
  "faviconUrl": null,
  "bannerDesktopUrl": "https://cdn.example.com/banner-desktop.webp",
  "bannerMobileUrl": "https://cdn.example.com/banner-mobile.webp",
  "socialImageUrl": null,
  "primaryColor": "#111111",
  "secondaryColor": "#eeeeee",
  "backgroundColor": "#ffffff",
  "theme": "SYSTEM",
  "defaultProductImageUrl": null
}
```

### Validacoes

- URLs devem passar por `r2UrlSchema`.
- Cores devem usar formato `#RRGGBB`.
- `theme` aceita `LIGHT`, `DARK`, `SYSTEM`.

## GET /settings/business-hours

Lista horarios semanais e excecoes.

### Query Params

| Param | Tipo | Obrigatorio |
|---|---|---|
| `contextType` | `ORGANIZATION` ou `ONLINE_STORE` | nao |
| `storeId` | `cuid` | nao |
| `channel` | `SettingsChannel` | nao |

## PUT /settings/business-hours

Substitui horarios semanais de um contexto/canal.

### Body

```json
{
  "contextType": "ONLINE_STORE",
  "storeId": "store_123",
  "channel": "DELIVERY",
  "hours": [
    {
      "dayOfWeek": 1,
      "periodIndex": 0,
      "opensAt": "08:00",
      "closesAt": "12:00",
      "isClosed": false,
      "is24Hours": false
    },
    {
      "dayOfWeek": 1,
      "periodIndex": 1,
      "opensAt": "14:00",
      "closesAt": "18:00",
      "isClosed": false,
      "is24Hours": false
    }
  ]
}
```

### Regras

- `dayOfWeek` usa `0` a `6`.
- `opensAt` e `closesAt` usam `HH:mm`.
- Multiplos periodos por dia sao permitidos.
- Periodos sobrepostos devem ser rejeitados pelo service.
- `isClosed` e `is24Hours` representam estados especiais.

## Business Hour Exceptions

### POST /settings/business-hours/exceptions

```json
{
  "storeId": "store_123",
  "channel": "DELIVERY",
  "date": "2026-12-25",
  "isClosed": true,
  "is24Hours": false,
  "opensAt": null,
  "closesAt": null,
  "reason": "Natal"
}
```

### PATCH /settings/business-hours/exceptions/:exceptionId

Body parcial do mesmo formato de criacao.

### DELETE /settings/business-hours/exceptions/:exceptionId

Remove a excecao do tenant efetivo.

## Online Orders Settings

### GET /settings/online-orders?storeId=:storeId

Retorna configuracoes persistidas e efetivas de pedidos online para a loja.

```json
{
  "storeId": "store_123",
  "settings": null,
  "effective": {
    "onlineOrderingEnabled": true,
    "digitalMenuEnabled": true,
    "deliveryEnabled": false,
    "pickupEnabled": true,
    "counterEnabled": false,
    "dineInEnabled": false,
    "allowOrdersOutsideHours": false,
    "autoAcceptOrders": false,
    "minimumOrderInCents": 0,
    "estimatedPreparationMinutes": 30,
    "estimatedDeliveryMinutes": 45,
    "freeDeliveryAboveInCents": null,
    "defaultDeliveryFeeInCents": 0,
    "closedMessage": null,
    "checkoutNotice": null,
    "orderConfirmationMessage": null,
    "requireCustomerName": true,
    "requireCustomerPhone": true,
    "requireDeliveryAddress": true,
    "allowCustomerNotes": true
  },
  "source": "DEFAULT"
}
```

### PATCH /settings/online-orders?storeId=:storeId

```json
{
  "onlineOrderingEnabled": true,
  "digitalMenuEnabled": true,
  "autoAcceptOrders": false,
  "minimumOrderInCents": 2000,
  "estimatedPreparationMinutes": 30,
  "allowOrdersOutsideHours": false,
  "closedMessage": "Estamos fechados no momento.",
  "checkoutNotice": "Confira seu endereco antes de enviar o pedido.",
  "orderConfirmationMessage": "Pedido recebido.",
  "requireCustomerName": true,
  "requireCustomerPhone": true,
  "allowCustomerNotes": true
}
```

## Delivery Settings

### GET /settings/delivery?storeId=:storeId

```json
{
  "storeId": "store_123",
  "settings": null,
  "delivery": {
    "deliveryEnabled": true,
    "pickupEnabled": true,
    "counterEnabled": false,
    "dineInEnabled": false,
    "estimatedDeliveryMinutes": 45,
    "freeDeliveryAboveInCents": 10000,
    "defaultDeliveryFeeInCents": 500,
    "requireDeliveryAddress": true
  },
  "source": "ONLINE_STORE_SETTINGS"
}
```

### PATCH /settings/delivery?storeId=:storeId

```json
{
  "deliveryEnabled": true,
  "pickupEnabled": true,
  "counterEnabled": false,
  "dineInEnabled": false,
  "allowOrdersOutsideHours": false,
  "estimatedDeliveryMinutes": 45,
  "freeDeliveryAboveInCents": 10000,
  "defaultDeliveryFeeInCents": 500,
  "requireDeliveryAddress": true
}
```

## Delivery Fee Rules

### GET /settings/delivery/rules?storeId=:storeId

```json
{
  "rules": []
}
```

### POST /settings/delivery/rules

Regra flat:

```json
{
  "storeId": "store_123",
  "name": "Taxa padrao",
  "type": "FLAT",
  "feeInCents": 500,
  "estimatedMinutes": 45,
  "minimumOrderInCents": 2000,
  "freeDeliveryAboveInCents": 10000,
  "active": true,
  "sortOrder": 0
}
```

Regra por bairro:

```json
{
  "storeId": "store_123",
  "name": "Centro",
  "type": "NEIGHBORHOOD",
  "neighborhood": "Centro",
  "feeInCents": 700,
  "estimatedMinutes": 50,
  "minimumOrderInCents": 2000,
  "freeDeliveryAboveInCents": 12000,
  "active": true,
  "sortOrder": 1
}
```

### PATCH /settings/delivery/rules/:ruleId

Body parcial do formato de criacao, exceto `storeId`.

### DELETE /settings/delivery/rules/:ruleId

Remove a regra. Pedidos historicos com `deliveryRuleId` usam foreign key `SET NULL`, preservando taxa/snapshot do pedido.

## Public Store Additions

`GET /public/stores/:slug` preserva os campos existentes e adiciona:

```json
{
  "operation": {
    "openNow": true,
    "acceptingOrders": true,
    "statusMessage": "Aberto agora",
    "unavailableReason": null,
    "estimatedPreparationMinutes": 30,
    "estimatedDeliveryMinutes": 45
  },
  "fulfillment": {
    "deliveryEnabled": true,
    "pickupEnabled": true,
    "counterEnabled": false,
    "dineInEnabled": false
  },
  "orderRules": {
    "minimumOrderInCents": 2000,
    "freeDeliveryAboveInCents": 10000,
    "defaultDeliveryFeeInCents": 500,
    "allowOrdersOutsideHours": false,
    "checkoutNotice": null,
    "requireCustomerName": true,
    "requireCustomerPhone": true,
    "requireDeliveryAddress": true,
    "allowCustomerNotes": true
  }
}
```

## Public Order Rules

`POST /public/stores/:slug/orders` continua aceitando `deliveryFeeInCents` por compatibilidade, mas o backend ignora o valor recebido e recalcula a taxa.

Novo campo opcional:

```json
{
  "fulfillment": "DELIVERY"
}
```

Valores aceitos nesta fase:

- `DELIVERY`
- `PICKUP`

Regras aplicadas pelo backend:

- delivery desabilitado retorna `400`;
- pickup desabilitado retorna `400`;
- loja inativa/fechada manualmente retorna `400`;
- fora do horario retorna `400`, salvo `allowOrdersOutsideHours`;
- subtotal abaixo do minimo retorna `400`;
- bairro nao atendido retorna `400` quando houver regras por bairro;
- taxa flat, bairro e entrega gratis sao calculadas no servidor;
- endereco e obrigatorio para delivery;
- endereco nao e obrigatorio para pickup.

## Erros

Formato exato de erro depende do handler global do backend. Consumidores devem tratar pelo menos:

| Status | Caso |
|---|---|
| `400` | Body/query invalido, contexto obrigatorio ausente ou transicao de regra invalida. |
| `401` | Token ausente/invalido. |
| `403` | Usuario sem permissao. |
| `404` | Store/event/device/exception nao encontrado no tenant. |
| `429` | Rate limit. |
| `500` | Erro inesperado. |

## Uso Recomendado pelo Frontend

- Usar `GET /settings` para carregar a tela geral do Centro de Configuracoes.
- Usar `GET /settings/effective` quando a tela precisar simular contexto de loja, evento, dispositivo, canal ou data.
- Nao ler diretamente campos legados como `Event.logoUrl`, `OnlineStore.isOpen` ou `Event.pixKey` em novas telas.
- Nao inferir permissoes apenas por modulo; usar `permissions` e `capabilities`.
- Tratar blocos futuros `null` como dominio ainda nao implementado.

## Referencias

- Arquitetura: `docs/architecture/settings-architecture.md`
- Rotas: `src/modules/settings/routes/settings-routes.ts`
- Schemas: `src/modules/settings/schemas/settings-schemas.ts`
- Agregador: `src/modules/settings/services/get-settings-service.ts`
- Resolver: `src/modules/settings/services/settings-resolver-service.ts`
