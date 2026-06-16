# Sistema Totem Backend

Backend do sistema de eventos e totem de autoatendimento, voltado para bares, festas e operacoes com pedidos em tempo real. O projeto atende tanto o fluxo publico do totem quanto o painel administrativo, integrando pagamentos, impressao, dispositivos e atualizacao em tempo real via Socket.IO.

## Visao Geral Do Projeto

Este backend centraliza:

- Sistema backend para eventos, bares e festas
- Suporte a totem de autoatendimento
- Painel administrativo
- Pedidos em tempo real
- Pagamentos via PIX Mercado Pago
- Impressao automatica
- Controle de dispositivos como SK210
- Tela publica de chamada e acompanhamento de pedidos

Fluxo operacional principal:

1. O cliente acessa o menu publico do evento.
2. O totem cria o pedido.
3. O backend registra o pedido e emite eventos em tempo real.
4. O pagamento segue por fluxo manual ou PIX automatico.
5. Quando o pagamento e confirmado, os jobs de impressao sao criados.
6. Impressoras TCP/IP ou dispositivos SK210 processam a fila.

## Stack Utilizada

| Tecnologia | Uso no projeto |
| --- | --- |
| Node.js | Runtime da aplicacao |
| TypeScript | Tipagem e organizacao do codigo |
| Fastify | Servidor HTTP |
| Prisma | ORM e acesso ao banco |
| PostgreSQL | Banco de dados principal |
| Socket.IO | Atualizacao em tempo real por evento |
| JWT | Autenticacao de usuarios e dispositivos |
| Zod | Validacao de payloads |
| Mercado Pago SDK | PIX automatico e consulta de pagamentos |
| Cloudflare R2 | Armazenamento de imagens |
| AWS SDK S3 | Integracao com o bucket R2 |
| `@fastify/multipart` | Upload de arquivos |

## Funcionalidades Atuais

- Autenticacao JWT
- Organizacoes
- Usuarios
- Eventos
- Catalogo
- Produtos por evento
- Pedidos
- Pagamento manual
- PIX automatico Mercado Pago
- Webhook Mercado Pago
- Expiracao configuravel de PIX por evento
- Cancelamento automatico de pedidos com PIX expirado
- Job automatico de expiracao de pagamentos
- Impressao automatica
- Fila de impressao
- Dispositivos SK210
- Heartbeat de dispositivos
- Socket.IO para atualizacao em tempo real
- Tela publica de chamada de pedidos
- Checkout publico do totem
- Cadastro e teste de impressoras
- Fechamento de evento com preview e resumo financeiro

## Arquitetura De Modulos

Estrutura principal do backend:

```text
backend/
├─ prisma/
│  ├─ migrations/
│  └─ schema.prisma
├─ src/
│  ├─ @types/
│  ├─ jobs/
│  │  └─ expire-pending-pix-job.ts
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
│  │  ├─ payments/
│  │  ├─ payment-provider-settings/
│  │  ├─ devices/
│  │  ├─ device-print-jobs/
│  │  ├─ print-jobs/
│  │  ├─ printers/
│  │  └─ metrics/
│  ├─ shared/
│  │  ├─ config/
│  │  └─ utils/
│  ├─ app.ts
│  └─ server.ts
├─ package.json
└─ tsconfig.json
```

Responsabilidade por area:

| Caminho | Responsabilidade |
| --- | --- |
| `src/modules/auth` | Login e emissao de JWT |
| `src/modules/users` | Criacao de usuarios e perfil autenticado |
| `src/modules/organizations` | Dominio previsto pela arquitetura; no estado atual existe no banco e na autorizacao, sem pasta HTTP dedicada |
| `src/modules/events` | Eventos, menu publico, fechamento, logo e configuracoes de operacao |
| `src/modules/orders` | Criacao de pedidos, status operacional, resumo financeiro e tela de chamada |
| `src/modules/payments` | Checkout, transacoes, webhook, PIX automatico e expiracao |
| `src/modules/devices` | Ativacao, heartbeat, configuracao e autenticacao de dispositivos |
| `src/modules/print-jobs` | Fila administrativa de impressao |
| `src/modules/printers` | Cadastro e teste de impressoras |
| `src/jobs` | Jobs periodicos do backend |
| `src/lib` | Prisma, Socket.IO e drivers de impressao |
| `src/shared` | Configuracoes compartilhadas e utilitarios |

## Modelos Principais

| Modelo | Papel no sistema |
| --- | --- |
| `Organization` | Agrupa usuarios, eventos, catalogo e configuracoes de pagamento |
| `User` | Usuario autenticado com papel de acesso |
| `Event` | Evento com configuracoes de totem, PIX, impressao e operacao |
| `CatalogCategory` | Categoria base do catalogo |
| `CatalogProduct` | Produto base do catalogo |
| `EventProduct` | Produto habilitado em um evento, com preco, estoque e disponibilidade |
| `Order` | Pedido do evento |
| `OrderItem` | Itens do pedido com snapshot de valores |
| `PaymentTransaction` | Historico e auditoria de tentativas de pagamento |
| `PaymentProviderSettings` | Configuracao do provedor por organizacao |
| `EventPrinter` | Impressora legada vinculada ao evento |
| `EventPrintJob` | Job de impressao gerado para um pedido |
| `Device` | Equipamento do tipo totem, printer, call screen ou SK210 |
| `EventClosing` | Resumo financeiro de fechamento do evento |

## Variaveis De Ambiente

Crie um arquivo `.env` na pasta `backend/`.

```env
DATABASE_URL=""
JWT_SECRET=""
MERCADO_PAGO_ACCESS_TOKEN=""
MERCADO_PAGO_PUBLIC_KEY=""
MERCADO_PAGO_WEBHOOK_SECRET=""
MERCADO_PAGO_WEBHOOK_URL=""
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL=""
```

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `DATABASE_URL` | Sim | String de conexao do PostgreSQL usada pelo Prisma |
| `JWT_SECRET` | Sim | Segredo usado para assinar JWT de usuarios e dispositivos |
| `MERCADO_PAGO_ACCESS_TOKEN` | Sim para PIX automatico | Token privado de integracao com Mercado Pago |
| `MERCADO_PAGO_PUBLIC_KEY` | Recomendado para frontend | Chave publica usada no checkout |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Recomendado | Segredo para validacao do webhook |
| `MERCADO_PAGO_WEBHOOK_URL` | Recomendado | URL publica configurada no Mercado Pago |
| `R2_ACCOUNT_ID` | Sim para upload | Account ID do Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Sim para upload | Access key do bucket R2 |
| `R2_SECRET_ACCESS_KEY` | Sim para upload | Secret key do bucket R2 |
| `R2_BUCKET_NAME` | Sim para upload | Nome do bucket usado para imagens |
| `R2_PUBLIC_URL` | Sim para URLs publicas | Base publica usada para compor URLs completas das imagens |

Importante:

- Nunca commite tokens reais, chaves ou segredos no repositorio.
- O arquivo `.env` deve permanecer fora do versionamento.
- Em ambientes compartilhados, prefira secrets do provedor de deploy.
- Todas as imagens devem ser armazenadas e servidas pelo Cloudflare R2.

## Como Rodar Localmente

```bash
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```

Observacoes:

- O servidor HTTP sobe na porta `3333`.
- O Socket.IO compartilha o mesmo servidor HTTP.
- O worker interno de impressao roda a cada `3` segundos.
- O job de expiracao de PIX roda a cada `30` segundos.

## Scripts Uteis

```bash
npm run dev
npx prisma studio
npx prisma migrate dev
npx prisma generate
npx tsc --noEmit
```

## Fluxo PIX Automatico

Fluxo completo de pagamento PIX automatico com Mercado Pago:

1. O totem cria o pedido em `POST /public/events/:slug/orders`.
2. O backend cria ou reaproveita uma transacao PIX no checkout publico.
3. O Mercado Pago gera o QR Code e os dados de copia e cola.
4. O backend salva a `PaymentTransaction` com `expiresAt`.
5. O totem exibe o QR Code com contador.
6. O cliente realiza o pagamento.
7. O Mercado Pago chama o webhook configurado.
8. O backend consulta o pagamento real no Mercado Pago e atualiza `PaymentTransaction` e `Order`.
9. O pedido passa para `PAID`.
10. Um `PrintJob` e criado.
11. A impressora TCP/IP ou o dispositivo SK210 executa a impressao.
12. O Socket.IO atualiza as telas operacionais e publicas.

Estados retornados pelo checkout publico:

- `paid`: pedido ja esta pago
- `operator`: pagamento precisa de intervencao humana ou nao ha metodo automatico disponivel
- `pix_manual`: evento possui PIX manual
- `pix_automatic`: transacao PIX automatica criada ou reaproveitada

## Expiracao De PIX

A expiracao do PIX no projeto funciona assim:

- O campo `Event.pixPaymentExpirationMinutes` define o tempo de validade do PIX por evento.
- O valor padrao no banco e `5` minutos.
- O backend aplica limites seguros de `2` a `15` minutos ao criar a transacao.
- O campo `PaymentTransaction.expiresAt` armazena a data/hora de expiracao da cobranca.
- A expiracao tambem e enviada ao Mercado Pago via `date_of_expiration`.
- O job automatico `expire-pending-pix-job` verifica transacoes vencidas periodicamente.
- Quando um PIX vence sem pagamento, a `PaymentTransaction` vira `EXPIRED`.
- O pedido vinculado muda para `CANCELLED`.
- O `paymentStatus` do pedido muda para `FAILED`.
- O backend emite o evento Socket.IO `payment-expired`.

Observacao importante:

- No estado atual do codigo, o campo `pixPaymentExpirationMinutes` ja existe no schema Prisma e ja e usado na criacao da transacao PIX. Caso a administracao do evento precise editar esse valor via payload HTTP, vale validar se o contrato exposto pela API ja contempla esse campo no seu fluxo de gestao.

## Webhook Mercado Pago

Rota do webhook:

```http
POST /webhooks/mercado-pago
```

Configure no painel Mercado Pago Developers uma URL publica acessivel pela internet:

```text
https://SEU_DOMINIO/webhooks/mercado-pago
```

Durante desenvolvimento local, use um tunel como `ngrok` para expor a API:

```text
https://SEU_SUBDOMINIO.ngrok-free.app/webhooks/mercado-pago
```

Recomendacoes:

- Configure notificacoes de `pagamentos`.
- Eventos de `order` ou `merchant_order` podem ser habilitados se fizerem sentido para sua operacao.
- O backend atual localiza a transacao pelo `paymentId` recebido e consulta o pagamento diretamente na API do Mercado Pago antes de sincronizar o pedido.

## Rotas Importantes

### Auth

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/sessions` | Login e emissao de JWT |
| `POST` | `/users` | Criacao de usuario |
| `GET` | `/users/profile` | Perfil do usuario autenticado |

### Events

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/events` | Cria evento |
| `GET` | `/events` | Lista eventos |
| `GET` | `/events/:id` | Busca evento por ID |
| `PATCH` | `/events/:id` | Atualiza configuracoes do evento |
| `PATCH` | `/events/:eventId/archive` | Arquiva evento |
| `PATCH` | `/events/:eventId/restore` | Restaura evento |
| `POST` | `/events/:eventId/close` | Fecha evento |
| `POST` | `/events/:eventId/reopen` | Reabre evento |
| `GET` | `/events/:eventId/closing-preview` | Preview do fechamento |
| `GET` | `/events/:eventId/closing` | Resumo do fechamento |
| `DELETE` | `/events/:eventId` | Remove evento |

Rotas relacionadas ao catalogo:

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/catalog/categories` | Cria categoria |
| `GET` | `/catalog/categories` | Lista categorias |
| `PATCH` | `/catalog/categories/:id` | Atualiza categoria |
| `POST` | `/catalog/products` | Cria produto |
| `GET` | `/catalog/products` | Lista produtos |
| `PATCH` | `/catalog/products/:id` | Atualiza produto |
| `POST` | `/events/:eventId/catalog-products` | Vincula produto ao evento |
| `GET` | `/events/:eventId/catalog-products` | Lista produtos do evento |
| `PATCH` | `/events/:eventId/catalog-products/:eventProductId` | Atualiza produto do evento |
| `DELETE` | `/events/:eventId/catalog-products/:eventProductId` | Remove produto do evento |

### Orders

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/events/:eventId/orders` | Lista pedidos do evento |
| `PATCH` | `/orders/:id/status` | Atualiza status operacional |
| `PATCH` | `/orders/:orderId/payment-status` | Atualiza status financeiro |
| `PATCH` | `/orders/:orderId/payment` | Marca pagamento manual |
| `GET` | `/events/:eventId/financial-summary` | Resumo financeiro |
| `GET` | `/events/:eventId/metrics` | Metricas do evento |

### Payments

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/orders/:orderId/payment-transactions` | Cria transacao de pagamento |
| `GET` | `/orders/:orderId/payment-transactions` | Lista transacoes do pedido |
| `PATCH` | `/payment-transactions/:paymentTransactionId/status` | Atualiza status da transacao |
| `GET` | `/events/:eventId/checkout-payment-settings` | Consulta disponibilidade de checkout |
| `POST` | `/orders/:orderId/pix-automatic-payment` | Cria PIX automatico publico |
| `POST` | `/orders/:orderId/checkout-payment` | Prepara checkout do pedido |
| `POST` | `/public/orders/:orderId/checkout-payment` | Alias publico do checkout |
| `POST` | `/webhooks/mercado-pago` | Recebe notificacoes do Mercado Pago |
| `POST` | `/expire-pending-pix-payments` | Disparo manual do servico de expiracao |
| `GET` | `/payment-provider-settings` | Lista configuracoes de provedores |
| `PUT` | `/payment-provider-settings/:provider` | Cria ou atualiza configuracao do provedor |

### Devices

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/devices` | Cria dispositivo |
| `GET` | `/devices` | Lista dispositivos |
| `GET` | `/devices/:id` | Busca dispositivo por ID |
| `PATCH` | `/devices/:id` | Atualiza dispositivo |
| `POST` | `/devices/:id/regenerate-credentials` | Regera credenciais |
| `POST` | `/devices/activate` | Ativa dispositivo com codigo e segredo |
| `GET` | `/devices/me/config` | Retorna configuracao do dispositivo autenticado |
| `POST` | `/devices/heartbeat` | Atualiza heartbeat do dispositivo |
| `GET` | `/devices/print-jobs/pending` | Lista jobs pendentes do device autenticado |
| `PATCH` | `/devices/print-jobs/:id/printed` | Marca job como impresso pelo device |
| `PATCH` | `/devices/print-jobs/:id/error` | Marca job com erro pelo device |

### Print Jobs

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/events/:eventId/print-jobs` | Lista jobs do evento |
| `PATCH` | `/print-jobs/:printJobId/cancel` | Cancela job |
| `PATCH` | `/print-jobs/:printJobId/printed` | Marca job como impresso |
| `PATCH` | `/print-jobs/:printJobId/retry` | Recoloca job na fila |
| `GET` | `/device/print-jobs/pending` | Fila administrativa para SK210 pelo painel |
| `PATCH` | `/device/print-jobs/:printJobId/printed` | Marca job como impresso via rota administrativa |
| `PATCH` | `/device/print-jobs/:printJobId/error` | Marca job com erro via rota administrativa |

### Printers

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/events/:eventId/printers` | Cadastra impressora do evento |
| `GET` | `/events/:eventId/printers` | Lista impressoras |
| `PATCH` | `/printers/:printerId` | Atualiza impressora |
| `POST` | `/printers/:printerId/test` | Testa impressora |

### Public Routes

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `GET` | `/public/events/:slug/menu` | Menu publico simples |
| `GET` | `/public/events/:slug/catalog-menu` | Menu publico baseado em catalogo |
| `POST` | `/public/events/:slug/orders` | Cria pedido publico do totem |
| `GET` | `/public/events/:slug/orders` | Alias da tela publica de pedidos |
| `GET` | `/public/events/:slug/call-screen-orders` | Tela publica de chamada |
| `GET` | `/public/orders/:orderId` | Consulta pedido publico |
| `POST` | `/public/orders/:orderId/checkout-payment` | Prepara checkout publico |

### Uploads

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/uploads/images` | Faz upload de imagem para o Cloudflare R2 e retorna a URL publica |

## Jobs

Job documentado:

- `expire-pending-pix-job`
- Responsavel por expirar PIX pendente automaticamente
- Roda periodicamente a cada `30` segundos
- Usa `ExpirePendingPixPaymentsService`

Outros processos internos relevantes:

- Worker de impressao TCP/IP roda no backend a cada `3` segundos
- Jobs vinculados a `deviceId` nao sao impressos pelo worker; eles ficam pendentes para SK210/app local

## Dispositivos E SK210

O modulo de dispositivos cobre:

- Device token JWT para autenticacao do equipamento
- Ativacao de dispositivo por `code` e `secret`
- Heartbeat periodico para atualizar `lastHeartbeatAt` e `lastSeenAt`
- Impressao local via SK210
- Fila de impressao por dispositivo
- Controle de status como `ACTIVE`, `PAUSED`, `OFFLINE` e `MAINTENANCE`

Tipos de dispositivo suportados no schema:

- `TOTEM`
- `PRINTER`
- `CALL_SCREEN`
- `SK210`

Resumo do fluxo:

1. O dispositivo e cadastrado pelo painel.
2. O backend gera credenciais e o device faz ativacao.
3. O dispositivo recebe `deviceToken`.
4. O device consulta `/devices/me/config`.
5. O device envia heartbeat em `/devices/heartbeat`.
6. Se houver jobs vinculados, busca em `/devices/print-jobs/pending`.

## Impressao

O backend suporta dois caminhos principais de impressao:

- `TCP_IP`: impressao automatica pela rede
- `SK210_LOCAL`: impressao local intermediada por app/dispositivo

Conceitos importantes:

- `EventPrintJob` representa cada item da fila de impressao
- Impressoras legadas continuam existindo no modelo `EventPrinter`
- O backend prioriza `Device` como modelo principal de equipamento de impressao e usa `EventPrinter` como fallback legado
- A impressao automatica acontece apos pagamento confirmado
- O evento pode operar em `FULL_ORDER`, `BY_SECTOR` ou `BOTH`
- Reimpressao e acao manual sao suportadas via rotas de `print-jobs`

Regras operacionais:

- Se `printingEnabled` estiver desligado, jobs nao sao gerados
- Se `autoPrintEnabled` estiver desligado, o worker nao imprime automaticamente
- Impressoras inativas geram erro de processamento
- Jobs com `deviceId` ficam reservados para o dispositivo local
- No modo por setor, a separacao considera o setor da categoria (`BAR` ou `KITCHEN`)

## Socket.IO

O backend utiliza salas por evento:

```text
event:{eventId}
```

Evento de entrada:

```text
join-event-room
```

Eventos principais:

| Evento | Quando ocorre |
| --- | --- |
| `order-created` | Quando um novo pedido e criado |
| `order-updated` | Quando status operacional ou financeiro muda |
| `payment-transaction-updated` | Quando uma transacao de pagamento e atualizada |
| `payment-expired` | Quando um PIX pendente vence e o pedido e cancelado |

## Regras De Negocio E Observacoes Operacionais

- Todo pedido novo nasce com `paymentStatus = PENDING`, salvo fluxos especiais
- Pedidos com pagamento pendente nao podem avancar para `PREPARING`, `READY` ou `DELIVERED`
- `Order.paymentStatus` guarda o estado atual do pedido
- `PaymentTransaction` guarda o historico e a auditoria do pagamento
- Pode existir mais de uma `PaymentTransaction` por pedido
- O fluxo manual tambem pode gerar `PaymentTransaction`
- Ao aprovar pagamento, o pedido e sincronizado para `PAID`
- Valores monetarios sao armazenados em centavos
- Cancelamento pode restaurar estoque quando `restoreStock = true`
- Arquivos enviados geram URLs publicas completas do Cloudflare R2

## Changelog Resumido

### `v0.2.0-pix-expiration`

- PIX com expiracao configuravel por evento
- Campo `expiresAt` em `PaymentTransaction`
- Expiracao enviada ao Mercado Pago
- Job automatico de expiracao
- Cancelamento automatico de pedidos vencidos
- Evento `payment-expired` via Socket.IO
- Correcoes no ciclo de vida PIX
- Melhorias no checkout publico
- Ajustes nos providers de pagamento

## Boas Praticas

- Nunca commitar `.env`
- Sempre rodar `npx tsc --noEmit` antes de commit
- Usar migrations versionadas
- Testar webhook com `ngrok`
- Validar PIX real em ambiente controlado
- Revisar credenciais do Mercado Pago antes de testar em producao
