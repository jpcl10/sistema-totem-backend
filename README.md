# Sistema Totem Backend

Backend do sistema de totem de autoatendimento para eventos.

Ele centraliza autenticacao, catalogo, pedidos, operacao em tempo real, financeiro, pagamentos e impressao. O backend atende tanto fluxos publicos do totem quanto fluxos autenticados de operacao e administracao.

## Visao Geral

Fluxo principal suportado hoje:

1. O cliente consulta o menu publico do evento.
2. O cliente cria um pedido no totem.
3. O pedido entra na fila operacional do evento.
4. O pagamento pode seguir por fluxo manual ou por checkout configurado.
5. O sistema registra transacoes em `PaymentTransaction`.
6. O backend emite atualizacoes em tempo real via Socket.IO.
7. A impressao pode acontecer por rede TCP/IP ou via app Android SK210.

## Stack

| Tecnologia | Uso |
| --- | --- |
| Node.js | Runtime da aplicacao |
| TypeScript | Tipagem e organizacao do codigo |
| Fastify | Servidor HTTP |
| Prisma ORM | Acesso ao banco e modelagem |
| PostgreSQL | Banco principal |
| Zod | Validacao de entrada |
| JWT | Autenticacao |
| Socket.IO | Realtime por evento |
| `@fastify/multipart` | Upload de arquivos |
| `@fastify/static` | Exposicao de arquivos enviados |
| Mercado Pago SDK | Checkout PIX automatico e webhook |

## Estrutura

```text
backend/
├─ prisma/
│  ├─ migrations/
│  └─ schema.prisma
├─ src/
│  ├─ @types/
│  ├─ lib/
│  │  ├─ printers/
│  │  ├─ prisma.ts
│  │  ├─ socket.ts
│  │  └─ thermal-printer.ts
│  ├─ modules/
│  │  ├─ auth/
│  │  ├─ users/
│  │  ├─ events/
│  │  ├─ catalog/
│  │  │  ├─ categories/
│  │  │  ├─ products/
│  │  │  └─ event-products/
│  │  ├─ orders/
│  │  ├─ metrics/
│  │  ├─ payments/
│  │  ├─ payment-provider-settings/
│  │  ├─ printers/
│  │  ├─ print-jobs/
│  │  ├─ device-print-jobs/
│  │  └─ devices/
│  ├─ shared/
│  │  └─ config/
│  ├─ app.ts
│  └─ server.ts
├─ uploads/
├─ package.json
├─ tsconfig.json
└─ .env
```

## Modulos

| Modulo | Responsabilidade |
| --- | --- |
| `auth` | Login e emissao de JWT |
| `users` | Criacao de usuario e perfil autenticado |
| `events` | Cadastro, listagem, configuracao e menus publicos |
| `catalog/categories` | Categorias do catalogo da organizacao |
| `catalog/products` | Produtos base do catalogo |
| `catalog/event-products` | Vinculo do catalogo com um evento, preco e estoque |
| `orders` | Criacao publica, listagem, status operacional e financeiro |
| `metrics` | Indicadores consolidados do evento |
| `payments` | Checkout publico, transacoes, webhook e sincronizacao de pagamento |
| `payment-provider-settings` | Configuracao por organizacao de provedores e capacidades de pagamento |
| `printers` | Cadastro e teste de impressoras do evento |
| `print-jobs` | Fila administrativa de impressao |
| `device-print-jobs` | Fila para o app Android SK210 |
| `devices` | Gerenciamento de dispositivos (totem, impressora, tela de chamada, SK210) |

> Observacao: o modelo `Organization` existe no banco e participa da autorizacao, mas nao possui um modulo HTTP proprio em `src/modules/organizations`.

## Ambiente

Crie um arquivo `.env` na pasta `backend/`.

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/nome_do_banco"
JWT_SECRET="defina_um_segredo_forte"

MERCADO_PAGO_ACCESS_TOKEN=""
MERCADO_PAGO_PUBLIC_KEY=""
MERCADO_PAGO_WEBHOOK_SECRET=""
MERCADO_PAGO_WEBHOOK_URL=""
```

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `DATABASE_URL` | Sim | String de conexao do PostgreSQL usada pelo Prisma |
| `JWT_SECRET` | Sim | Segredo usado para assinar e validar tokens JWT |
| `MERCADO_PAGO_ACCESS_TOKEN` | Nao | Token para operacoes com Mercado Pago |
| `MERCADO_PAGO_PUBLIC_KEY` | Nao | Chave publica usada pelo checkout |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Nao | Segredo do webhook |
| `MERCADO_PAGO_WEBHOOK_URL` | Nao | URL publica esperada para webhook |

### Observacoes

- A aplicacao sobe na porta `3333`.
- Arquivos enviados sao servidos em `/uploads/*`.
- O servidor Socket.IO compartilha o mesmo servidor HTTP.
- O worker interno de impressao roda a cada `3` segundos.

## Instalacao

```bash
npm install
```

## Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

## Execucao

### Desenvolvimento

```bash
npm run dev
```

### Migrations

```bash
npx prisma migrate dev
```

### Prisma Client

```bash
npx prisma generate
```

### Validacao TypeScript

```bash
npx tsc --noEmit
```

## Modelos Principais

| Modelo | Papel no sistema |
| --- | --- |
| `Organization` | Agrupa usuarios, eventos e catalogo |
| `User` | Usuario autenticado com papel de acesso |
| `Event` | Evento com configuracoes de totem, PIX e impressao |
| `CatalogCategory` | Categoria base do catalogo |
| `CatalogProduct` | Produto base do catalogo |
| `EventProduct` | Produto habilitado em um evento com preco e estoque |
| `Order` | Pedido realizado no evento |
| `OrderItem` | Item do pedido com snapshot de dados |
| `PaymentTransaction` | Historico de tentativas e atualizacoes de pagamento |
| `PaymentProviderSettings` | Configuracao do provedor por organizacao |
| `EventPrinter` | Impressora vinculada ao evento |
| `EventPrintJob` | Job de impressao gerado para um pedido |
| `EventClosing` | Fechamento do evento com resumo financeiro |
| `Device` | Dispositivo vinculado a organizacao ou evento (totem, impressora, tela de chamada, SK210) |

## Regras De Negocio

- Todo pedido novo nasce com `paymentStatus = PENDING`.
- Pedidos com pagamento pendente nao podem ir para `PREPARING`, `READY` ou `DELIVERED`.
- `Order.paymentStatus` guarda o estado atual do pagamento.
- `PaymentTransaction` guarda o historico e a auditoria do pagamento.
- Pode haver mais de uma `PaymentTransaction` por pedido.
- O fluxo manual tambem gera `PaymentTransaction`.
- Ao aprovar uma transacao, o pedido e sincronizado para `PAID`.
- Valores monetarios sao armazenados em centavos.
- Cancelamento pode restaurar estoque quando `restoreStock = true`.
- Jobs `SK210_LOCAL` nao sao impressos pelo worker; eles ficam pendentes para o app Android.

## Pagamentos

O backend suporta hoje tres camadas relacionadas a pagamento:

1. Fluxo manual operado pelo painel.
2. Checkout publico para decidir o proximo passo de pagamento.
3. Integracao com PIX automatico via Mercado Pago quando configurado.

### Como O Checkout Decide O Proximo Passo

O endpoint `POST /orders/:orderId/checkout-payment` ou `POST /public/orders/:orderId/checkout-payment` devolve um fluxo orientado por estado:

- `paid`: pedido ja pago
- `operator`: sem metodo automatico disponivel ou pedido cancelado
- `pix_manual`: evento com PIX manual disponivel
- `pix_automatic`: transacao PIX automatica criada ou reaproveitada

### Fluxo Manual

```text
Pedido criado
-> paymentStatus = PENDING
-> operador confirma pagamento
-> PATCH /orders/:orderId/payment
-> pedido vira PAID
-> PaymentTransaction MANUAL / APPROVED e registrada
```

### Fluxo PIX Automatico

Quando a organizacao possui `MERCADO_PAGO` habilitado com PIX ativo e token configurado:

1. O checkout tenta reutilizar uma transacao `WAITING_PAYMENT` existente.
2. Se nao existir, cria uma nova `PaymentTransaction`.
3. O retorno pode incluir `qrCode`, `qrCodeBase64` e `pixCopyPaste`.
4. O webhook do Mercado Pago consulta o pagamento real e sincroniza a transacao.
5. Quando aprovado, o pedido vira `PAID` e os print jobs podem ser gerados.

### Configuracao Por Provedor

O modulo `payment-provider-settings` permite habilitar ou desabilitar:

- provedor como um todo
- PIX
- cartao
- terminal

Tambem permite armazenar de forma segura se existem credenciais configuradas para `accessToken`, `publicKey`, `webhookSecret` e `webhookUrl`.

## Impressao

O backend trabalha com dois tipos de impressora:

- `TCP_IP`: impressao automatica pela rede
- `SK210_LOCAL`: impressao local intermediada pelo app Android

### Regras

- Se `printingEnabled` estiver desligado no evento, nao sao gerados jobs.
- O modo do evento pode ser `FULL_ORDER`, `BY_SECTOR` ou `BOTH`.
- Impressoras inativas nao processam jobs.
- Job sem impressora vinculada termina em `ERROR`.
- No modo por setor, a separacao considera o setor da categoria.

### Fluxo SK210

```http
GET /device/print-jobs/pending?eventId=...
PATCH /device/print-jobs/:printJobId/printed
PATCH /device/print-jobs/:printJobId/error
```

## Realtime

Sala por evento:

```text
event:{eventId}
```

Evento de entrada:

```text
join-event-room
```

Eventos emitidos:

| Evento | Quando ocorre |
| --- | --- |
| `order-created` | Quando um novo pedido e criado |
| `order-updated` | Quando status operacional ou financeiro muda |
| `payment-transaction-updated` | Quando uma transacao de pagamento e atualizada |

## Endpoints Principais

### Autenticacao E Usuarios

| Metodo | Endpoint | Protegido | Descricao |
| --- | --- | --- | --- |
| `POST` | `/sessions` | Nao | Login e emissao de JWT |
| `POST` | `/users` | Nao | Cria usuario |
| `GET` | `/users/profile` | Sim | Retorna usuario autenticado |

### Eventos E Catalogo

| Metodo | Endpoint | Protegido | Descricao |
| --- | --- | --- | --- |
| `POST` | `/events` | Sim | Cria evento |
| `GET` | `/events` | Sim | Lista eventos |
| `GET` | `/events/:id` | Sim | Busca um evento |
| `PATCH` | `/events/:id` | Sim | Atualiza configuracoes do evento |
| `POST` | `/events/:id/logo` | Sim | Faz upload de logo |
| `DELETE` | `/events/:eventId` | Sim | Deleta evento |
| `PATCH` | `/events/:eventId/archive` | Sim | Arquiva evento |
| `PATCH` | `/events/:eventId/restore` | Sim | Restaura evento arquivado |
| `POST` | `/events/:eventId/close` | Sim | Fecha evento |
| `POST` | `/events/:eventId/reopen` | Sim | Reabre evento fechado |
| `GET` | `/events/:eventId/closing-preview` | Sim | Preview do fechamento do evento |
| `GET` | `/events/:eventId/closing` | Sim | Fechamento do evento |
| `GET` | `/public/events/:slug/menu` | Nao | Menu publico simples |
| `GET` | `/public/events/:slug/catalog-menu` | Nao | Menu publico baseado em catalogo |
| `POST` | `/catalog/categories` | Sim | Cria categoria |
| `GET` | `/catalog/categories` | Sim | Lista categorias |
| `PATCH` | `/catalog/categories/:id` | Sim | Atualiza categoria |
| `POST` | `/catalog/products` | Sim | Cria produto |
| `GET` | `/catalog/products` | Sim | Lista produtos |
| `PATCH` | `/catalog/products/:id` | Sim | Atualiza produto |
| `POST` | `/catalog/products/:id/image` | Sim | Faz upload de imagem do produto |
| `POST` | `/events/:eventId/catalog-products` | Sim | Vincula produto ao evento |
| `GET` | `/events/:eventId/catalog-products` | Sim | Lista produtos do evento |
| `PATCH` | `/events/:eventId/catalog-products/:eventProductId` | Sim | Atualiza produto do evento |
| `DELETE` | `/events/:eventId/catalog-products/:eventProductId` | Sim | Remove produto do evento |

### Pedidos, Financeiro E Metrics

| Metodo | Endpoint | Protegido | Descricao |
| --- | --- | --- | --- |
| `POST` | `/public/events/:slug/orders` | Nao | Cria pedido publico pelo totem |
| `GET` | `/public/events/:slug/orders` | Nao | Lista pedidos para tela de chamada (alias) |
| `GET` | `/public/events/:slug/call-screen-orders` | Nao | Lista pedidos para tela de chamada |
| `GET` | `/events/:eventId/orders` | Sim | Lista pedidos do evento |
| `PATCH` | `/orders/:id/status` | Sim | Atualiza status operacional |
| `PATCH` | `/orders/:orderId/payment-status` | Sim | Atualiza apenas status financeiro |
| `PATCH` | `/orders/:orderId/payment` | Sim | Marca pagamento com detalhes |
| `GET` | `/events/:eventId/financial-summary` | Sim | Retorna resumo financeiro |
| `GET` | `/events/:eventId/metrics` | Sim | Retorna metricas do evento (aceita parametros `period`, `startDate` e `endDate` para filtro por periodo) |

### Payments

| Metodo | Endpoint | Protegido | Descricao |
| --- | --- | --- | --- |
| `POST` | `/orders/:orderId/payment-transactions` | Sim | Cria transacao vinculada ao pedido |
| `GET` | `/orders/:orderId/payment-transactions` | Sim | Lista historico de transacoes |
| `PATCH` | `/payment-transactions/:paymentTransactionId/status` | Sim | Atualiza status de uma transacao |
| `GET` | `/events/:eventId/checkout-payment-settings` | Nao | Retorna disponibilidade de pagamento para o evento |
| `POST` | `/orders/:orderId/pix-automatic-payment` | Nao | Cria transacao publica de PIX automatico |
| `POST` | `/orders/:orderId/checkout-payment` | Nao | Prepara checkout do pedido |
| `POST` | `/public/orders/:orderId/checkout-payment` | Nao | Alias publico para preparar checkout |
| `POST` | `/webhooks/mercado-pago` | Nao | Recebe webhook do Mercado Pago |

### Configuracao De Provedores

| Metodo | Endpoint | Protegido | Descricao |
| --- | --- | --- | --- |
| `GET` | `/payment-provider-settings` | Sim | Lista configuracoes de provedores da organizacao |
| `PUT` | `/payment-provider-settings/:provider` | Sim | Cria ou atualiza configuracao de um provedor |

### Impressoras E Filas

| Metodo | Endpoint | Protegido | Descricao |
| --- | --- | --- | --- |
| `POST` | `/events/:eventId/printers` | Sim | Cadastra impressora do evento |
| `GET` | `/events/:eventId/printers` | Sim | Lista impressoras do evento |
| `PATCH` | `/printers/:printerId` | Sim | Atualiza impressora |
| `POST` | `/printers/:printerId/test` | Sim | Testa impressora |
| `GET` | `/events/:eventId/print-jobs` | Sim | Lista jobs do evento |
| `PATCH` | `/print-jobs/:printJobId/cancel` | Sim | Cancela print job |
| `PATCH` | `/print-jobs/:printJobId/printed` | Sim | Marca print job como impresso |
| `PATCH` | `/print-jobs/:printJobId/retry` | Sim | Recoloca print job para tentativa |
| `GET` | `/device/print-jobs/pending` | Sim | Lista jobs pendentes para SK210 |
| `PATCH` | `/device/print-jobs/:printJobId/printed` | Sim | Marca job como impresso pelo device |
| `PATCH` | `/device/print-jobs/:printJobId/error` | Sim | Marca job com erro pelo device |

### Dispositivos

| Metodo | Endpoint | Protegido | Descricao |
| --- | --- | --- | --- |
| `POST` | `/devices` | Sim | Cria dispositivo |
| `GET` | `/devices` | Sim | Lista dispositivos da organizacao |
| `GET` | `/devices/:id` | Sim | Busca dispositivo por ID |
| `PATCH` | `/devices/:id` | Sim | Atualiza dispositivo |
| `POST` | `/devices/:id/regenerate-credentials` | Sim | Regera credenciais do dispositivo |
| `POST` | `/devices/activate` | Nao | Ativa dispositivo usando codigo e segredo |
| `GET` | `/devices/me/config` | Dispositivo | Retorna configuracoes do dispositivo autenticado |
| `POST` | `/devices/heartbeat` | Dispositivo | Envia heartbeat do dispositivo |

## Payloads De Exemplo

### Login

```json
{
  "email": "admin@evento.com",
  "password": "123456"
}
```

### Criacao De Pedido

```json
{
  "customerName": "Maria",
  "items": [
    {
      "productId": "cm_event_product_1",
      "quantity": 1
    },
    {
      "productId": "cm_event_product_2",
      "quantity": 2
    }
  ]
}
```

### Marcacao Manual De Pagamento

```json
{
  "paymentStatus": "PAID",
  "paymentMethod": "PIX_MANUAL",
  "amountPaidInCents": 1200,
  "changeForInCents": null,
  "paymentNotes": "PIX conferido manualmente pelo operador"
}
```

### Criacao Manual De PaymentTransaction

```json
{
  "provider": "MANUAL",
  "method": "PIX_MANUAL",
  "amountInCents": 1200,
  "externalReference": "manual-test-001",
  "gatewayStatus": "created",
  "gatewayMessage": "Transacao manual de teste",
  "metadata": {
    "source": "admin-test"
  }
}
```

### Upsert De Configuracao De Provedor

```json
{
  "enabled": true,
  "pixEnabled": true,
  "cardEnabled": false,
  "terminalEnabled": false,
  "accessToken": "APP_USR-...",
  "publicKey": "APP_USR-...",
  "webhookSecret": "segredo-do-webhook",
  "webhookUrl": "https://seu-dominio.com/webhooks/mercado-pago"
}
```

### Erro De Device

```json
{
  "errorMessage": "Sem papel na impressora local"
}
```

## Erros Comuns

| Problema | Possivel causa | Solucao |
| --- | --- | --- |
| `Event not found` | `slug` ou `eventId` invalido | Verifique o identificador informado |
| `Order not found` | Pedido inexistente ou fora do contexto autorizado | Confirme o ID e a organizacao autenticada |
| `Unauthorized` | Token ausente ou invalido | Refaca login e envie `Authorization: Bearer <token>` |
| `Payment must be confirmed before changing order status` | Tentativa de preparar pedido sem pagamento | Marque o pagamento antes de avancar o status |
| `Payment method is required when payment is paid` | Marcacao de `PAID` sem metodo | Informe `paymentMethod` |
| `Amount must be greater than zero` | Valor invalido na transacao | Informe `amountInCents` maior que zero |
| `Some products were not found or are unavailable` | Produto inativo, removido ou esgotado | Revise os itens enviados |
| `Insufficient stock` | Estoque menor que a quantidade pedida | Ajuste estoque ou quantidade |
| Print job em `ERROR` | Impressora ausente, inativa ou mal configurada | Revise cadastro e conexao |
| Checkout cai para `operator` | Provedor nao esta habilitado ou configurado | Revise `payment-provider-settings` e credenciais |

## Status Atual

### Ja Implementado

- Autenticacao com JWT
- CRUD principal de eventos, usuarios e catalogo
- Arquivar, restaurar, fechar e reabrir eventos
- Fechamento de evento com preview
- Criacao publica de pedidos
- Fluxo financeiro manual com historico em `PaymentTransaction`
- Checkout publico para decidir o proximo passo do pagamento
- Configuracao de provedores por organizacao
- PIX automatico com Mercado Pago
- Webhook do Mercado Pago
- Emissao de eventos via Socket.IO
- Cadastro de impressoras e fila de impressao
- Integracao com app Android SK210
- Gerenciamento de dispositivos (totem, impressora, tela de chamada, SK210)

### Evolucoes Naturais

- Ampliar provedores alem de Mercado Pago
- Melhorar conciliacao financeira
- Refinar regras de impressao pos-pagamento
- Fortalecer observabilidade e logs operacionais
- Expandir regras de autorizacao por perfil

## Comandos Uteis

```bash
npm install
npm run dev
npx prisma migrate dev
npx prisma generate
npx tsc --noEmit
```
