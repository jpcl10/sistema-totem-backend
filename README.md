# Defumar Events Platform - Backend

**Versão:** 1.0.0  
**Última atualização:** Julho de 2026  
**Licença:** Proprietária

---

## 1. Visão Geral

O **Defumar Events Platform** é um sistema SaaS multi-tenant completo e enterprise-grade para gerenciamento de eventos, pedidos de totem, lojas online para delivery, pagamentos, impressão térmica, cartões NFC para pagamentos cashless, e muito mais.

### 1.1 Objetivo da Plataforma

Fornecer uma solução unificada para empresas de eventos, bares, restaurantes e food trucks, permitindo:
- Gerenciamento completo de eventos
- Totens de autoatendimento para pedidos rápidos
- Lojas online com delivery integrado
- Impressão automática de pedidos em impressoras térmicas
- Sistema de pagamentos múltiplos (PIX, cartão, dinheiro, NFC)
- Cartões NFC para pagamentos sem dinheiro e fidelidade
- Relatórios detalhados e fechamento de caixa
- Sistema de dispositivos e autenticação segura
- Gerenciamento multi-tenant para múltiplas organizações

### 1.2 Conceito do Sistema

A plataforma é **multi-tenant nativa**, onde cada cliente é uma `Organization` com:
- Seus próprios usuários
- Seus próprios eventos
- Seu próprio catálogo de produtos
- Seu próprio estoque
- Seus próprios pedidos e relatórios
- Seu próprio gerenciamento de lojas online
- Seu próprio gerenciamento de impressoras e dispositivos
- Seus próprios cartões NFC

### 1.3 Arquitetura Multi-Tenant

```mermaid
graph TB
    subgraph "Nível Global"
        A[Usuário SUPER_ADMIN]
    end
    
    subgraph "Organização A"
        B[Usuário ADMIN Org A]
        C[Usuário OPERATOR Org A]
        D[Evento 1 Org A]
        E[Evento 2 Org A]
        F[Loja Online Org A]
        G[Catálogo Org A]
    end
    
    subgraph "Organização B"
        H[Usuário ADMIN Org B]
        I[Evento 1 Org B]
        J[Catálogo Org B]
    end
    
    A -->|"Impersonifica usando"| x-organization-id["Header x-organization-id"]
    x-organization-id --> B
    x-organization-id --> H
    B --> D
    B --> E
    B --> F
    C --> D
```

### 1.4 Fluxo Geral da Plataforma

```mermaid
graph LR
    Organization[Organization] --> User[Usuários]
    Organization --> Event[Eventos]
    Organization --> Catalog[Catálogo de Produtos]
    Organization --> OnlineStore[Lojas Online]
    Organization --> PaymentProviderSettings[Provedores de Pagamento]
    Organization --> Device[Dispositivos]
    Organization --> AuditLog[Auditoria]
    
    Event --> EventProduct[Produtos do Evento]
    Event --> Order[Pedidos do Evento]
    Event --> EventPrinter[Impressoras do Evento]
    Event --> NFC[Cartões NFC]
    
    Order --> OrderItem[Itens do Pedido]
    Order --> PaymentTransaction[Transações de Pagamento]
    Order --> EventPrintJob[Jobs de Impressão]
    
    OnlineStore --> Customer[Clientes]
    OnlineStore --> OnlineProduct[Produtos Online]
    OnlineStore --> OnlineOrder[Pedidos Online]
    Customer --> CustomerAddress[Endereços dos Clientes]
```

---

## 2. Stack Tecnológica

### 2.1 Backend
- **Node.js (v20+)**: Motor de execução JavaScript/TypeScript
- **TypeScript (v5+)**: Linguagem de programação tipada para segurança e produtividade
- **Fastify (v5+)**: Framework web extremamente rápido, eficiente e seguro para Node.js
- **Zod (v4+)**: Biblioteca de validação de schemas TypeScript-first
- **Socket.IO**: Comunicação bidirecional em tempo real
- **bcryptjs**: Criptografia de senhas segura (bcrypt)
- **jsonwebtoken**: Autenticação stateless usando JWT

### 2.2 Banco de Dados
- **PostgreSQL**: Banco de dados relacional ACID, robusto e escalável
- **Prisma ORM**: ORM moderno TypeScript-first com:
  - Client tipado
  - Migrações de banco de dados versionadas
  - Prisma Studio para visualização e edição de dados

### 2.3 Upload e Armazenamento
- **AWS SDK for JavaScript (v3)**: Integração com Cloudflare R2 (compatível com S3) para armazenamento seguro de imagens (catálogo, logotipos, banners, etc.)

### 2.4 Autenticação e Autorização
- **JSON Web Tokens (JWT)**: Autenticação stateless para usuários e dispositivos
- **Role-Based Access Control (RBAC)**: Hierarquia de funções (SUPER_ADMIN, ADMIN, OPERATOR)

### 2.5 Cache e Jobs
- **In-Memory Jobs no Fastify**: Jobs recorrentes em background (ex: expirar pagamentos PIX pendentes, processar jobs de impressão)

### 2.6 Pagamentos
- **Mercado Pago**: Integração nativa com gateway de pagamento para PIX automático e cartões
- **PagSeguro, Cielo, GetNet, Stone**: Estrutura pronta para integração
- **PIX Manual e Automático**: Suporte completo a pagamentos via PIX
- **Cartão de Crédito, Débito, Dinheiro**: Outros métodos de pagamento suportados

### 2.7 Impressão
- **Impressoras Térmicas TCP/IP**: Suporte a impressoras conectadas via rede (ex: Epson TM-T20X, TM-T88, etc.) na porta 9100
- **Gertec SK210**: Suporte a dispositivos Android Gertec SK210 para impressão local

### 2.8 NFC
- **Leitores NFC**: Suporte a leitores de cartões NFC para pagamentos cashless, recarga de saldo, identificação de clientes, etc.

### 2.9 APK Bridge (SK210)
- **APK Android para Gertec SK210**: Aplicativo dedicado para dispositivos Gertec SK210 que funciona como:
  - Totem de autoatendimento
  - Impressora local
  - Leitor de cartões NFC
  - Dispositivo de gerenciamento de pedidos

---

## 3. Estrutura do Projeto

```plaintext
backend/
├── prisma/                            # Prisma ORM config and migrations
│   ├── migrations/                    # Migrações do banco de dados (versionadas)
│   │   ├── 20260512145536_init/       # Migração inicial
│   │   ├── 20260512175232_update_event_model/
│   │   └── ... (outras migrações)
│   ├── audit-db.ts                    # Script de auditoria do banco
│   ├── reset-user-password.ts         # Script para resetar senha de usuário
│   ├── migrate-online-catalog-to-standard.ts
│   ├── seed.ts                        # Script para popular o banco com dados de teste
│   └── schema.prisma                  # Schema do banco de dados (models & enums)
├── src/
│   ├── @types/                        # Tipos TypeScript globais
│   │   └── fastify.d.ts               # Tipos para Fastify (user, device, etc.)
│   ├── lib/                           # Bibliotecas e utilitários compartilhados
│   │   ├── printers/                  # Drivers de impressoras
│   │   │   ├── gertec-sk210-printer.ts
│   │   │   ├── printer-factory.ts     # Factory para criar impressoras
│   │   │   ├── tcp-printer.ts         # Driver para impressoras TCP/IP
│   │   │   └── thermal-printer.ts     # Comandos ESC/POS para impressoras térmicas
│   │   ├── get-effective-organization-id.ts # Lógica para resolver o tenant (organization)
│   │   ├── logger.ts                  # Configuração do logger (Pino)
│   │   ├── prisma.ts                  # Instância singleton do Prisma Client
│   │   ├── r2.ts                      # Integração com Cloudflare R2 para uploads
│   │   └── socket.ts                  # Configuração do Socket.IO
│   ├── jobs/                          # Jobs recorrentes em background
│   │   └── expire-pending-pix-job.ts  # Job para expirar pagamentos PIX pendentes
│   ├── modules/                       # Módulos da aplicação
│   │   ├── auth/                      # Autenticação
│   │   │   ├── controllers/
│   │   │   │   └── authenticate-controller.ts
│   │   │   ├── middlewares/
│   │   │   │   ├── verify-jwt.ts      # Valida tokens JWT de usuários
│   │   │   │   └── verify-super-admin.ts # Valida se o usuário é SUPER_ADMIN
│   │   │   ├── routes/
│   │   │   │   └── authenticate-routes.ts
│   │   │   ├── schemas/
│   │   │   │   └── authenticate-schema.ts
│   │   │   └── services/
│   │   │       └── authenticate-service.ts
│   │   ├── audit-logs/                # Logs de auditoria
│   │   ├── catalog/                   # Catálogo de produtos
│   │   │   ├── categories/            # Categorias do catálogo
│   │   │   ├── event-products/        # Produtos específicos de eventos
│   │   │   └── products/              # Produtos do catálogo
│   │   ├── device-print-jobs/         # Jobs de impressão para dispositivos
│   │   ├── devices/                   # Dispositivos (totem, impressora, tela de chamada, SK210)
│   │   ├── events/                    # Eventos
│   │   ├── health/                    # Health check da API
│   │   ├── metrics/                   # Métricas de eventos
│   │   ├── nfc-cards/                 # Cartões NFC
│   │   ├── online-stores/             # Lojas online
│   │   ├── orders/                    # Pedidos de eventos
│   │   ├── payment-provider-settings/ # Configurações de provedores de pagamento
│   │   ├── payments/                  # Pagamentos
│   │   │   ├── providers/             # Provedores de pagamento
│   │   │   │   ├── mercado-pago-provider.ts
│   │   │   │   ├── manual-payment-provider.ts
│   │   │   │   └── payment-provider-factory.ts
│   │   ├── print-jobs/                # Jobs de impressão
│   │   ├── printers/                  # Impressoras
│   │   ├── super-admin/               # Funcionalidades de Super Admin
│   │   ├── uploads/                   # Uploads de imagens
│   │   └── users/                     # Usuários
│   ├── shared/                        # Código compartilhado
│   │   ├── config/
│   │   │   └── mercado-pago.ts
│   │   └── utils/
│   │       ├── get-period-date-filter.ts
│   │       └── r2-url-schema.ts
│   ├── app.ts                         # Configuração do Fastify (CORS, plugins, rotas, jobs)
│   └── server.ts                      # Ponto de entrada da aplicação, inicializa servidor e Socket.IO
├── .env.example                       # Exemplo de arquivo .env com todas as variáveis necessárias
├── .gitignore
├── package.json
├── package-lock.json
├── prisma.config.ts                   # Configuração do Prisma
├── tsconfig.json
├── README.md (este arquivo)
└── AUDITORIA_FINAL.md
```

---

## 4. Banco de Dados

### 4.1 Visão Geral das Tabelas

#### Organization
Representa uma organização/empresa/cliente da plataforma (tenant).
- **Campos**: id, name, slug, createdAt, updatedAt
- **Relações**: users, events, catalogCategories, catalogProducts, paymentProviderSettings, eventClosings, nfcCards, nfcCardReads, nfcCardTransactions, organizationModules, onlineStores, customers
- **Constraints**: slug é único globalmente

#### User
Usuário da plataforma.
- **Campos**: id, organizationId, name, email, password, role, createdAt, updatedAt
- **Relações**: organization, auditLogs, eventClosings, nfcCardReads, nfcCardTransactions
- **Roles**: SUPER_ADMIN, ADMIN, OPERATOR
- **Constraints**: email é único globalmente

#### Event
Evento criado por uma organização.
- **Campos**: id, organizationId, name, slug, primaryColor, secondaryColor, logoUrl, bannerUrl, totemWelcomeMessage, totemBackgroundColor, totemTextColor, totemShowPrices, totemShowLowStock, totemRequireCustomerName, totemAutoResetSeconds, totemShowLogo, totemFullscreenRecommended, pixEnabled, pixKey, pixReceiverName, pixCity, pixInstructions, pixPaymentExpirationMinutes, printingEnabled, autoPrintEnabled, printMode, printerPaperSize, closed, closedAt, active, startsAt, endsAt, createdAt, updatedAt
- **Relações**: organization, orders, devices, eventProducts, printJobs, printers, nfcCards, nfcCardReads, nfcCardTransactions, closing
- **Constraints**: [organizationId, slug] é único

#### CatalogCategory
Categoria do catálogo organizacional.
- **Campos**: id, organizationId, name, slug, sector, active, createdAt, updatedAt
- **Relações**: organization, products
- **Sector**: BAR, KITCHEN
- **Constraints**: [organizationId, slug] é único

#### CatalogProduct
Produto do catálogo organizacional.
- **Campos**: id, organizationId, catalogCategoryId, name, slug, description, imageUrl, priceInCents, active, createdAt, updatedAt
- **Relações**: organization, catalogCategory, eventProducts, orderItems, onlineOrderItems
- **Constraints**: [organizationId, slug] é único

#### EventProduct
Produto disponível em um evento específico, pode ter preço e estoque diferentes do catálogo.
- **Campos**: id, eventId, catalogProductId, priceInCents, trackStock, stockQuantity, soldOut, active, createdAt, updatedAt
- **Relações**: event, catalogProduct
- **Constraints**: [eventId, catalogProductId] é único

#### Order
Pedido de evento.
- **Campos**: id, eventId, deviceId, customerName, orderNumber, status, paymentStatus, paymentMethod, totalInCents, amountPaidInCents, changeForInCents, paidAt, paymentNotes, cancelReason, cancelledAt, createdAt, updatedAt
- **Relações**: event, device, items, printJobs, paymentTransactions
- **Status**: CONFIRMED, PREPARING, READY, DELIVERED, CANCELLED
- **Payment Status**: NOT_REQUIRED, PENDING, PAID, FAILED, CANCELLED, REFUNDED
- **Constraints**: [eventId, orderNumber] é único

#### OrderItem
Item de um pedido de evento.
- **Campos**: id, orderId, productId, catalogProductId, quantity, unitPriceInCents, totalInCents, productName
- **Relações**: order, catalogProduct

#### PaymentTransaction
Transação de pagamento para um pedido.
- **Campos**: id, orderId, provider, status, method, amountInCents, externalId, externalReference, qrCode, qrCodeBase64, pixCopyPaste, gatewayStatus, gatewayMessage, approvedAt, rejectedAt, cancelledAt, refundedAt, expiredAt, expiresAt, errorMessage, metadata, createdAt, updatedAt
- **Relações**: order
- **Providers**: MANUAL, MERCADO_PAGO, STONE, PAGSEGURO, CIELO, GETNET, OTHER
- **Constraints**: [provider, externalId] é único

#### EventPrinter
Impressora configurada para um evento.
- **Campos**: id, eventId, name, sector, connectionType, ipAddress, port, paperSize, active, createdAt, updatedAt
- **Relações**: event, printJobs
- **Sector**: FULL_ORDER, BAR, KITCHEN
- **Connection Type**: TCP_IP, SK210_LOCAL

#### EventPrintJob
Job de impressão para um pedido de evento.
- **Campos**: id, eventId, orderId, printerId, deviceId, sector, status, payload, printedAt, errorMessage, createdAt, updatedAt
- **Relações**: event, order, printer, device
- **Status**: PENDING, PRINTED, ERROR, CANCELLED

#### EventClosing
Fechamento de caixa de um evento, com métricas financeiras detalhadas.
- **Campos**: id, eventId, organizationId, closedByUserId, totalOrders, paidOrders, pendingOrders, cancelledOrders, receivedInCents, pendingInCents, cancelledInCents, averageTicketInCents, pixManualInCents, pixAutomaticInCents, cashInCents, creditCardInCents, debitCardInCents, courtesyInCents, otherInCents, printPendingCount, printPrintedCount, printErrorCount, printCancelledCount, notes, closedAt, createdAt, updatedAt
- **Relações**: event, organization, closedByUser
- **Constraints**: eventId é único

#### Device
Dispositivo conectado à plataforma (totem, impressora, tela de chamada, SK210).
- **Campos**: id, organizationId, eventId, name, code, locationName, type, status, authStatus, tokenHash, deviceSecretHash, appVersion, lastSeenAt, lastHeartbeatAt, lastActivatedAt, lastIpAddress, lastUserAgent, metadata, createdAt, updatedAt
- **Relações**: organization, event, orders, printJobs, nfcCardReads, auditLogs
- **Type**: TOTEM, PRINTER, CALL_SCREEN, SK210
- **Status**: ACTIVE, PAUSED, OFFLINE, MAINTENANCE
- **Auth Status**: PENDING, ACTIVE, REVOKED
- **Constraints**: code é único

#### AuditLog
Log de auditoria para todas as ações importantes na plataforma.
- **Campos**: id, organizationId, eventId, userId, deviceId, entity, entityId, action, description, metadata, createdAt
- **Relações**: organization, event, user, device
- **Actions**: ORDER_CREATED, ORDER_UPDATED, ORDER_CANCELLED, ORDER_PAYMENT_STATUS_UPDATED, PAYMENT_CREATED, PAYMENT_APPROVED, PAYMENT_EXPIRED, PAYMENT_REJECTED, PAYMENT_REFUNDED, PAYMENT_MANUAL_MARKED, PAYMENT_PROVIDER_SETTINGS_UPDATED, EVENT_CREATED, EVENT_UPDATED, EVENT_CLOSED, PRODUCT_CREATED, PRODUCT_UPDATED, EVENT_PRODUCT_CREATED, EVENT_PRODUCT_UPDATED, EVENT_PRODUCT_DELETED, IMAGE_UPLOADED, DEVICE_CREATED, DEVICE_ACTIVATED, DEVICE_REVOKED, PRINT_JOB_CREATED, PRINT_JOB_PRINTED, PRINT_JOB_ERROR, USER_LOGGED_IN, USER_CREATED, NFC_CARD_CREATED, NFC_CARD_UPDATED, NFC_CARD_BLOCKED, NFC_CARD_READ, NFC_BALANCE_TOPUP, NFC_BALANCE_DEBIT, NFC_BALANCE_ADJUST, NFC_BALANCE_REFUND

#### NfcCard
Cartão NFC para pagamentos cashless.
- **Campos**: id, organizationId, eventId, uid, code, holderName, type, status, balanceInCents, metadata, createdAt, updatedAt
- **Relações**: organization, event, nfcCardReads, nfcCardTransactions
- **Type**: CUSTOMER, STAFF, VIP, COMANDA
- **Status**: ACTIVE, BLOCKED, LOST
- **Constraints**: uid é único

#### NfcCardTransaction
Transação de cartão NFC (recarga, compra, ajuste, estorno, etc.).
- **Campos**: id, organizationId, eventId, nfcCardId, userId, type, amountInCents, balanceBeforeInCents, balanceAfterInCents, description, metadata, createdAt
- **Relações**: organization, event, nfcCard, user
- **Type**: TOPUP, PURCHASE, REFUND, ADJUSTMENT, BONUS, REVERSAL

#### NfcCardRead
Registro de leitura de cartão NFC.
- **Campos**: id, organizationId, eventId, nfcCardId, userId, deviceId, uid, source, createdAt
- **Relações**: organization, event, nfcCard, user, device
- **Source**: ADMIN_PANEL, TOTEM, SK210, ACCESS_CONTROL

#### OrganizationModule
Módulo habilitado/desabilitado por organização.
- **Campos**: id, organizationId, moduleKey, enabled, createdAt, updatedAt
- **Relações**: organization
- **Modules**: ONLINE_ORDERS, TOTEM, EVENTS, PAYMENTS, PRINTING, NFC_CASHLESS, FINANCIAL, DEVICES, REPORTS, DELIVERY, WHATSAPP, LOYALTY
- **Constraints**: [organizationId, moduleKey] é único

#### OnlineStore
Loja online para delivery de uma organização.
- **Campos**: id, organizationId, name, slug, whatsapp, city, address, logoUrl, bannerUrl, isOpen, active, createdAt, updatedAt
- **Relações**: organization, orders, categories, products
- **Constraints**: slug é único globalmente

#### OnlineCategory
Categoria de loja online.
- **Campos**: id, storeId, name, slug, sortOrder, active, createdAt, updatedAt
- **Relações**: store, products
- **Constraints**: [storeId, slug] é único

#### OnlineProduct
Produto de loja online.
- **Campos**: id, storeId, categoryId, name, description, imageUrl, priceInCents, active, sortOrder, createdAt, updatedAt
- **Relações**: store, category, orderItems
- **Constraints**: [storeId, name] é único

#### OnlineOrder
Pedido de loja online (delivery).
- **Campos**: id, storeId, orderNumber, customerId, customerAddressId, customerName, customerPhone, deliveryAddress, deliveryNumber, deliveryNeighborhood, deliveryComplement, deliveryReference, paymentMethod, changeForInCents, subtotalInCents, deliveryFeeInCents, totalInCents, status, notes, createdAt, updatedAt
- **Relações**: store, customer, customerAddress, items
- **Payment Method**: PIX, CARD_ON_DELIVERY, CASH
- **Status**: RECEIVED, CONFIRMED, PREPARING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
- **Constraints**: [storeId, orderNumber] é único

#### OnlineOrderItem
Item de um pedido de loja online.
- **Campos**: id, orderId, productId, catalogProductId, productName, quantity, unitPriceInCents, totalInCents, notes, createdAt
- **Relações**: order, product, catalogProduct

#### Customer
Cliente de loja online.
- **Campos**: id, organizationId, name, phone, email, createdAt, updatedAt
- **Relações**: organization, addresses, orders
- **Constraints**: [organizationId, phone] é único

#### CustomerAddress
Endereço de cliente de loja online.
- **Campos**: id, customerId, title, street, number, neighborhood, city, complement, reference, isDefault, createdAt, updatedAt
- **Relações**: customer, orders

### 4.2 Diagrama ER (Entidade-Relacionamento)

```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : contains
    ORGANIZATION ||--o{ EVENT : has
    ORGANIZATION ||--o{ CATALOG_CATEGORY : owns
    ORGANIZATION ||--o{ CATALOG_PRODUCT : owns
    ORGANIZATION ||--o{ ONLINE_STORE : has
    ORGANIZATION ||--o{ CUSTOMER : has
    ORGANIZATION ||--o{ ORGANIZATION_MODULE : has
    
    EVENT ||--o{ ORDER : receives
    EVENT ||--o{ EVENT_PRODUCT : offers
    EVENT ||--o{ EVENT_PRINTER : has
    EVENT ||--o{ EVENT_PRINT_JOB : generates
    
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER ||--o{ PAYMENT_TRANSACTION : has
    ORDER ||--o{ EVENT_PRINT_JOB : triggers
    
    CATALOG_CATEGORY ||--o{ CATALOG_PRODUCT : has
    CATALOG_PRODUCT ||--o{ EVENT_PRODUCT : linked_to
    
    ONLINE_STORE ||--o{ ONLINE_ORDER : receives
    ONLINE_STORE ||--o{ ONLINE_CATEGORY : has
    ONLINE_STORE ||--o{ ONLINE_PRODUCT : offers
    ONLINE_ORDER ||--|{ ONLINE_ORDER_ITEM : contains
    CUSTOMER ||--o{ ONLINE_ORDER : places
    CUSTOMER ||--o{ CUSTOMER_ADDRESS : has
```

---

## 5. Módulos da Aplicação

### 5.1 Auth
Gerenciamento de autenticação de usuários e dispositivos.
- **Login de usuário**: Autenticação com email e senha, retorna token JWT
- **Verificação de token**: Middleware `verify-jwt` para validar tokens em rotas protegidas
- **Super Admin**: Middleware `verify-super-admin` para rotas exclusivas de super admins

### 5.2 Users
Gerenciamento de usuários da organização.
- **Criar usuário**: Apenas ADMIN ou SUPER_ADMIN pode criar usuários
- **Perfil do usuário**: Obter dados do usuário autenticado

### 5.3 Events
Gerenciamento completo de eventos.
- **Criar evento**: Definir nome, slug, configurações de totem, PIX, impressão, etc.
- **Editar evento**: Atualizar dados e configurações do evento
- **Listar eventos**: Listar eventos da organização (ativos/inativos)
- **Arquivar evento**: Desativar evento (não deleta, mantém histórico)
- **Restaurar evento**: Reativar evento arquivado
- **Fechar evento**: Fechar caixa do evento, gerar registro `EventClosing` com métricas financeiras
- **Reabrir evento**: Reabrir evento já fechado
- **Menu público**: Obter menu do evento para totens e clientes (rota pública)

### 5.4 Catalog
Gerenciamento de categorias e produtos do catálogo organizacional, além de produtos específicos de eventos.
- **Categorias**: CRUD de categorias do catálogo
- **Produtos**: CRUD de produtos do catálogo
- **Produtos de evento**: Vincular produtos do catálogo a eventos, definir preço e estoque específicos

### 5.5 Orders
Gerenciamento de pedidos de eventos.
- **Criar pedido**: Criar pedido manualmente ou via totem/dispositivo
- **Venda manual**: Criar venda manual rápida
- **Atualizar status do pedido**: CONFIRMED → PREPARING → READY → DELIVERED
- **Atualizar status de pagamento**: Marcar pedido como pago, estornar, etc.
- **Listar pedidos**: Listar pedidos do evento, com filtros por status, data, etc.
- **Tela de chamada**: Listar pedidos prontos para retirada (rota pública)
- **Detalhes do pedido público**: Obter pedido por ID (rota pública)

### 5.6 Payments
Gerenciamento de pagamentos.
- **Criar transação**: Criar transação de pagamento para pedido
- **Listar transações**: Listar transações de um pedido
- **Atualizar status da transação**: Atualizar status manualmente (ex: marcar PIX como pago)
- **Preparar checkout público**: Preparar pagamento para checkout público
- **PIX automático**: Criar pagamento PIX automático via Mercado Pago
- **Webhook Mercado Pago**: Receber notificações de status do Mercado Pago
- **Expirar PIX**: Job para expirar pagamentos PIX pendentes após tempo definido no evento

### 5.7 Payment Provider Settings
Gerenciamento de configurações de provedores de pagamento por organização.
- **Upsert configurações**: Criar ou atualizar configurações de provedor de pagamento
- **Listar configurações**: Listar provedores de pagamento habilitados da organização

### 5.8 Print Jobs
Gerenciamento de jobs de impressão para pedidos.
- **Listar jobs**: Listar jobs de impressão do evento, com filtros por status
- **Marcar como impresso**: Marcar job como impresso manualmente
- **Reimprimir job**: Reenviar job para impressora
- **Cancelar job**: Cancelar job de impressão
- **Processar jobs**: Job em background que tenta imprimir jobs pendentes a cada 3 segundos

### 5.9 Printers
Gerenciamento de impressoras de eventos.
- **Criar impressora**: Configurar impressora para evento (TCP/IP ou SK210_LOCAL)
- **Listar impressoras**: Listar impressoras do evento
- **Atualizar impressora**: Editar configurações da impressora
- **Testar impressora**: Enviar impressão de teste para a impressora

### 5.10 Devices
Gerenciamento de dispositivos (totens, impressoras, telas de chamada, SK210).
- **Criar dispositivo**: Criar dispositivo, gerar código de pareamento
- **Listar dispositivos**: Listar dispositivos da organização
- **Obter dispositivo**: Obter detalhes do dispositivo
- **Atualizar dispositivo**: Editar configurações do dispositivo
- **Parear dispositivo**: Ativar dispositivo usando código de pareamento
- **Regenerar credenciais**: Gerar novo código de pareamento para dispositivo
- **Heartbeat**: Dispositivo envia heartbeat periódico para manter status online
- **Configuração do dispositivo**: Obter configurações do dispositivo para inicialização
- **Jobs de impressão do dispositivo**: Listar jobs de impressão pendentes para o dispositivo

### 5.11 NFC Cards
Gerenciamento de cartões NFC.
- **Criar cartão**: Criar cartão NFC com UID único
- **Listar cartões**: Listar cartões NFC da organização/evento
- **Atualizar cartão**: Editar dados do cartão
- **Bloquear cartão**: Bloquear cartão para não permitir transações
- **Obter cartão por UID**: Buscar cartão pelo UID (para leitores)
- **Identificar cartão**: Identificar cartão pelo UID (rota pública para dispositivos)
- **Ler cartão**: Registrar leitura de cartão
- **Listar leituras**: Listar histórico de leituras de cartões
- **Recarregar cartão**: Recarregar saldo do cartão
- **Debitar cartão**: Debitar valor do cartão para pagamento
- **Ajustar saldo**: Ajustar saldo do cartão manualmente (positivo ou negativo)
- **Estornar cartão**: Estornar valor para o cartão
- **Pagar pedido com NFC**: Usar cartão NFC para pagar um pedido de evento
- **Listar transações**: Listar histórico de transações do cartão

### 5.12 Online Stores
Gerenciamento de lojas online.
- **Criar loja**: Criar loja online para organização
- **Listar lojas**: Listar lojas da organização
- **Obter loja**: Obter detalhes da loja
- **Atualizar loja**: Editar configurações da loja
- **Menu público**: Obter menu da loja online (rota pública)
- **Criar pedido online**: Criar pedido de loja online (rota pública)
- **Listar pedidos online**: Listar pedidos da loja, com filtros
- **Atualizar status do pedido online**: Atualizar status do pedido (RECEIVED → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED)
- **Resumo da loja**: Obter métricas da loja (pedidos hoje, faturamento, etc.)
- **Buscar cliente por telefone**: Buscar cliente por telefone (rota pública, para lojas online)
- **Histórico de pedidos do cliente**: Obter histórico de pedidos do cliente

### 5.13 Audit Logs
Visualização de logs de auditoria.
- **Listar logs do evento**: Listar logs de auditoria de um evento específico, com filtros por ação, data, usuário, etc.

### 5.14 Metrics
Métricas de eventos.
- **Métricas do evento**: Obter métricas detalhadas do evento (pedidos, faturamento, ticket médio, formas de pagamento, etc.), com filtro por período

### 5.15 Super Admin
Funcionalidades exclusivas de super admins.
- **Criar organização**: Criar nova organização (tenant)
- **Listar organizações**: Listar todas as organizações da plataforma
- **Obter organização**: Obter detalhes de uma organização
- **Atualizar organização**: Editar dados da organização
- **Atualizar módulos da organização**: Habilitar/desabilitar módulos para uma organização
- **Criar super admin**: Criar novo usuário SUPER_ADMIN
- **Listar super admins**: Listar usuários SUPER_ADMIN da plataforma

### 5.16 Uploads
Upload de imagens para a plataforma.
- **Upload de imagem**: Fazer upload de imagem para Cloudflare R2, retorna URL pública

### 5.17 Health
Health check da API.
- **Status da API**: Verificar se a API está funcionando corretamente

---

## 6. Endpoints da API

### 6.1 Autenticação (`/auth`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| POST | `/login` | Autentica um usuário e retorna token JWT | Público | `{ email: string, password: string }` | `{ token: string, user: { id, name, email, role, organizationId } }` |

### 6.2 Usuários (`/users`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/profile` | Obtém o perfil do usuário autenticado | ADMIN, OPERATOR, SUPER_ADMIN | - | `{ id, name, email, role, organizationId, organizationModules }` |
| POST | `/` | Cria um novo usuário na organização | ADMIN, SUPER_ADMIN | `{ name, email, password, role }` | User criado |

### 6.3 Eventos (`/events`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/` | Lista eventos da organização | ADMIN, OPERATOR, SUPER_ADMIN | Query params: `?active=true/false` | Lista de eventos |
| POST | `/` | Cria um novo evento | ADMIN, SUPER_ADMIN | Dados do evento | Evento criado |
| GET | `/:id` | Obtém detalhes de um evento | ADMIN, OPERATOR, SUPER_ADMIN | - | Evento completo |
| PUT | `/:id` | Atualiza um evento | ADMIN, SUPER_ADMIN | Dados do evento | Evento atualizado |
| DELETE | `/:id` | Arquiva um evento | ADMIN, SUPER_ADMIN | - | Evento arquivado |
| PATCH | `/:id/archive` | Arquiva evento (mesmo que DELETE) | ADMIN, SUPER_ADMIN | - | Evento arquivado |
| PATCH | `/:id/reopen` | Reabre evento arquivado | ADMIN, SUPER_ADMIN | - | Evento reaberto |
| PATCH | `/:id/restore` | Restaura evento | ADMIN, SUPER_ADMIN | - | Evento restaurado |
| GET | `/:id/closing-preview` | Obtém prévia do fechamento do evento | ADMIN, SUPER_ADMIN | - | Prévia das métricas de fechamento |
| POST | `/:id/close` | Fecha o evento (gera EventClosing) | ADMIN, SUPER_ADMIN | `{ notes?: string }` | EventClosing gerado |
| GET | `/:id/closing` | Obtém fechamento do evento | ADMIN, SUPER_ADMIN | - | EventClosing completo |
| GET | `/public/:slug` | Obtém menu público do evento | Público | - | Menu do evento (categorias, produtos) |
| GET | `/public/:slug/catalog` | Obtém catálogo público do evento | Público | - | Catálogo completo do evento |

### 6.4 Catálogo (`/catalog`)

#### Categorias (`/catalog/categories`)
| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/` | Lista categorias do catálogo | ADMIN, OPERATOR, SUPER_ADMIN | - | Lista de categorias |
| POST | `/` | Cria nova categoria | ADMIN, SUPER_ADMIN | `{ name, slug, sector }` | Categoria criada |
| PUT | `/:id` | Atualiza categoria | ADMIN, SUPER_ADMIN | Mesmo que POST | Categoria atualizada |

#### Produtos (`/catalog/products`)
| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/` | Lista produtos do catálogo | ADMIN, OPERATOR, SUPER_ADMIN | - | Lista de produtos |
| POST | `/` | Cria novo produto | ADMIN, SUPER_ADMIN | `{ name, slug, catalogCategoryId, description?, imageUrl?, priceInCents }` | Produto criado |
| PUT | `/:id` | Atualiza produto | ADMIN, SUPER_ADMIN | Mesmo que POST | Produto atualizado |

#### Produtos de Evento (`/catalog/event-products`)
| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/events/:eventId/catalog-products` | Lista produtos do evento | ADMIN, OPERATOR, SUPER_ADMIN | - | Lista de produtos do evento |
| GET | `/events/:eventId/catalog-products/available` | Lista produtos globais disponiveis para vinculo | ADMIN, OPERATOR, SUPER_ADMIN | Query params: `search`, `categoryId`, `active`, `page`, `limit` | Lista paginada |
| POST | `/events/:eventId/catalog-products` | Adiciona produto ao evento | ADMIN, SUPER_ADMIN | `{ catalogProductId, priceInCents?, active?, trackStock?, stockQuantity? }` | EventProduct criado |
| POST | `/events/:eventId/catalog-products/bulk` | Adiciona produtos ao evento em lote | ADMIN, SUPER_ADMIN | `{ products: [...] }` | Resumo de criados/existentes |
| POST | `/events/:eventId/catalog/sync?dryRun=true` | Sincroniza catalogo global elegivel para `EventProduct` reais | ADMIN, SUPER_ADMIN | - | Resumo de `created`, `alreadyLinked`, `skipped` |
| PATCH | `/events/:eventId/catalog-products/:eventProductId` | Atualiza produto do evento | ADMIN, SUPER_ADMIN | Campos parciais de EventProduct | EventProduct atualizado |
| DELETE | `/events/:eventId/catalog-products/:eventProductId` | Remove produto do evento | ADMIN, SUPER_ADMIN | - | EventProduct deletado |

### 6.5 Pedidos (`/orders`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/events/:eventId` | Lista pedidos do evento | ADMIN, OPERATOR, SUPER_ADMIN | Query params: `?status, ?paymentStatus, ?startDate, ?endDate` | Lista de pedidos |
| POST | `/events/:eventId` | Cria novo pedido | ADMIN, OPERATOR, SUPER_ADMIN | `{ customerName?, items: [{ catalogProductId, quantity }] }` | Pedido criado |
| POST | `/events/:eventId/manual-sale` | Cria venda manual rápida | ADMIN, OPERATOR, SUPER_ADMIN | `{ paymentMethod, amountPaidInCents?, items: [...] }` | Venda criada |
| GET | `/public/:id` | Obtém pedido público (para clientes) | Público | - | Pedido completo |
| GET | `/public/events/:eventId/call-screen` | Obtém pedidos para tela de chamada | Público | - | Pedidos READY |
| PATCH | `/:id/status` | Atualiza status do pedido | ADMIN, OPERATOR, SUPER_ADMIN | `{ status: OrderStatus }` | Pedido atualizado |
| PATCH | `/:id/payment-status` | Atualiza status de pagamento | ADMIN, OPERATOR, SUPER_ADMIN | `{ paymentStatus, paymentMethod?, amountPaidInCents? }` | Pedido atualizado |
| GET | `/:eventId/financial-summary` | Obtém resumo financeiro do evento | ADMIN, SUPER_ADMIN | - | Resumo financeiro |

### 6.6 Pagamentos (`/payments`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| POST | `/orders/:orderId/transactions` | Cria transação de pagamento | ADMIN, OPERATOR, SUPER_ADMIN | `{ provider, method, amountInCents, externalId? }` | Transação criada |
| GET | `/orders/:orderId/transactions` | Lista transações do pedido | ADMIN, OPERATOR, SUPER_ADMIN | - | Lista de transações |
| PATCH | `/transactions/:id/status` | Atualiza status da transação | ADMIN, OPERATOR, SUPER_ADMIN | `{ status, gatewayStatus?, gatewayMessage? }` | Transação atualizada |
| POST | `/webhooks/mercado-pago` | Webhook do Mercado Pago | Público (verificado via header) | Dados do webhook | - |
| POST | `/public/checkout/prepare` | Prepara checkout público | Público | `{ orderId, provider }` | Dados para checkout |
| POST | `/public/pix/automatic` | Cria pagamento PIX automático | Público | `{ orderId }` | QR Code e dados PIX |
| POST | `/expire-pending` | Expira pagamentos PIX pendentes (para job) | ADMIN, SUPER_ADMIN | - | Confirmação |

### 6.7 Payment Provider Settings (`/payment-provider-settings`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/` | Lista configurações de provedores da organização | ADMIN, SUPER_ADMIN | - | Lista de configurações |
| POST | `/` | Cria/atualiza configuração de provedor | ADMIN, SUPER_ADMIN | `{ provider, enabled, pixEnabled, cardEnabled, terminalEnabled, accessToken, publicKey?, webhookSecret?, webhookUrl? }` | Configuração upsertada |

### 6.8 Print Jobs (`/print-jobs`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/events/:eventId` | Lista jobs de impressão do evento | ADMIN, OPERATOR, SUPER_ADMIN | Query params: `?status` | Lista de jobs |
| PATCH | `/:id/mark-printed` | Marca job como impresso | ADMIN, OPERATOR, SUPER_ADMIN | - | Job atualizado |
| PATCH | `/:id/retry` | Reenvia job para impressora | ADMIN, OPERATOR, SUPER_ADMIN | - | Job reenviado |
| PATCH | `/:id/cancel` | Cancela job | ADMIN, OPERATOR, SUPER_ADMIN | - | Job cancelado |

### 6.9 Printers (`/printers`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/events/:eventId` | Lista impressoras do evento | ADMIN, SUPER_ADMIN | - | Lista de impressoras |
| POST | `/events/:eventId` | Cria impressora para evento | ADMIN, SUPER_ADMIN | `{ name, sector, connectionType, ipAddress, port?, paperSize? }` | Impressora criada |
| PUT | `/:id` | Atualiza impressora | ADMIN, SUPER_ADMIN | Mesmo que POST | Impressora atualizada |
| POST | `/:id/test` | Envia impressão de teste | ADMIN, SUPER_ADMIN | - | Confirmação |

### 6.10 Devices (`/devices`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/` | Lista dispositivos da organização | ADMIN, SUPER_ADMIN | - | Lista de dispositivos |
| POST | `/` | Cria dispositivo | ADMIN, SUPER_ADMIN | `{ name, type, locationName? }` | Dispositivo criado com código |
| GET | `/:id` | Obtém dispositivo | ADMIN, SUPER_ADMIN | - | Dispositivo completo |
| PUT | `/:id` | Atualiza dispositivo | ADMIN, SUPER_ADMIN | Mesmo que POST | Dispositivo atualizado |
| POST | `/:id/regenerate-credentials` | Regenera credenciais do dispositivo | ADMIN, SUPER_ADMIN | - | Novo código gerado |
| POST | `/activate` | Ativa dispositivo usando código | Público | `{ code, deviceSecret }` | Token de dispositivo |
| POST | `/heartbeat` | Heartbeat do dispositivo | Dispositivo autenticado | `{ appVersion? }` | - |
| GET | `/config` | Obtém configurações do dispositivo | Dispositivo autenticado | - | Configurações |
| GET | `/pending-print-jobs` | Obtém jobs de impressão pendentes do dispositivo | Dispositivo autenticado | - | Jobs pendentes |
| PATCH | `/print-jobs/:jobId/mark-printed` | Marca job como impresso pelo dispositivo | Dispositivo autenticado | - | Job atualizado |
| PATCH | `/print-jobs/:jobId/mark-error` | Marca job com erro pelo dispositivo | Dispositivo autenticado | `{ errorMessage }` | Job atualizado |

### 6.11 NFC Cards (`/nfc-cards`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/events/:eventId` | Lista cartões do evento | ADMIN, OPERATOR, SUPER_ADMIN | - | Lista de cartões |
| POST | `/events/:eventId` | Cria cartão NFC | ADMIN, SUPER_ADMIN | `{ uid, code?, holderName?, type? }` | Cartão criado |
| GET | `/uid/:uid` | Obtém cartão por UID | ADMIN, OPERATOR, SUPER_ADMIN | - | Cartão completo |
| PUT | `/:id` | Atualiza cartão | ADMIN, SUPER_ADMIN | Mesmo que POST | Cartão atualizado |
| PATCH | `/:id/block` | Bloqueia cartão | ADMIN, SUPER_ADMIN | - | Cartão bloqueado |
| POST | `/identify` | Identifica cartão por UID (rota pública) | Público | `{ uid }` | Cartão (se existir) |
| POST | `/read` | Registra leitura de cartão | ADMIN, OPERATOR, SUPER_ADMIN | `{ uid, source? }` | Leitura registrada |
| GET | `/:id/reads` | Lista leituras do cartão | ADMIN, SUPER_ADMIN | - | Lista de leituras |
| POST | `/:id/topup` | Recarrega cartão | ADMIN, SUPER_ADMIN | `{ amountInCents, description? }` | Transação criada |
| POST | `/:id/debit` | Debita cartão | ADMIN, SUPER_ADMIN | `{ amountInCents, description? }` | Transação criada |
| POST | `/:id/adjust` | Ajusta saldo do cartão | ADMIN, SUPER_ADMIN | `{ amountInCents, description? }` | Transação criada |
| POST | `/:id/refund` | Estorna cartão | ADMIN, SUPER_ADMIN | `{ amountInCents, description? }` | Transação criada |
| POST | `/pay-order` | Paga pedido com cartão NFC | ADMIN, OPERATOR, SUPER_ADMIN | `{ orderId, uid }` | Pedido pago e transação criada |
| GET | `/:id/transactions` | Lista transações do cartão | ADMIN, SUPER_ADMIN | - | Lista de transações |

### 6.12 Online Stores (`/online-stores`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/` | Lista lojas da organização | ADMIN, SUPER_ADMIN | - | Lista de lojas |
| POST | `/` | Cria loja online | ADMIN, SUPER_ADMIN | `{ name, slug, whatsapp, city, address?, logoUrl?, bannerUrl? }` | Loja criada |
| GET | `/:id` | Obtém loja | ADMIN, SUPER_ADMIN | - | Loja completa |
| PUT | `/:id` | Atualiza loja | ADMIN, SUPER_ADMIN | Mesmo que POST | Loja atualizada |
| GET | `/:id/summary` | Obtém resumo da loja | ADMIN, SUPER_ADMIN | - | Métricas da loja |
| GET | `/public/:slug` | Obtém loja pública | Público | - | Loja pública |
| GET | `/public/:slug/menu` | Obtém menu público da loja | Público | - | Menu completo |
| POST | `/public/:slug/orders` | Cria pedido público | Público | `{ customerName, customerPhone, deliveryAddress, deliveryNumber, deliveryNeighborhood, deliveryComplement?, deliveryReference?, paymentMethod, changeForInCents?, items: [{ productId, quantity, notes? }], notes? }` | Pedido criado |
| GET | `/:storeId/orders` | Lista pedidos da loja | ADMIN, OPERATOR, SUPER_ADMIN | - | Lista de pedidos |
| PATCH | `/orders/:id/status` | Atualiza status do pedido online | ADMIN, OPERATOR, SUPER_ADMIN | `{ status: OnlineOrderStatus }` | Pedido atualizado |
| GET | `/public/:slug/customers/by-phone` | Busca cliente por telefone | Público | Query param: `?phone=` | Cliente (se existir) |
| GET | `/public/:slug/customers/:customerId/orders` | Obtém histórico do cliente | Público | - | Pedidos do cliente |

### 6.13 Audit Logs (`/audit-logs`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/events/:eventId` | Lista logs do evento | ADMIN, SUPER_ADMIN | Query params: `?action, ?startDate, ?endDate, ?limit, ?offset` | Lista de logs |

### 6.14 Metrics (`/metrics`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/events/:eventId` | Obtém métricas do evento | ADMIN, SUPER_ADMIN | Query params: `?period=daily/weekly/monthly/custom&startDate&endDate` | Métricas completas |

### 6.15 Super Admin (`/super-admin`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/organizations` | Lista todas as organizações | SUPER_ADMIN | - | Lista de organizações |
| POST | `/organizations` | Cria nova organização | SUPER_ADMIN | `{ name, slug }` | Organização criada |
| GET | `/organizations/:id` | Obtém organização | SUPER_ADMIN | - | Organização completa |
| PUT | `/organizations/:id` | Atualiza organização | SUPER_ADMIN | Mesmo que POST | Organização atualizada |
| PATCH | `/organizations/:id/modules` | Atualiza módulos da organização | SUPER_ADMIN | `{ modules: [{ moduleKey, enabled }] }` | Módulos atualizados |
| POST | `/super-admin-users` | Cria super admin | SUPER_ADMIN | `{ name, email, password }` | Super admin criado |
| GET | `/super-admin-users` | Lista super admins | SUPER_ADMIN | - | Lista de super admins |

### 6.16 Uploads (`/uploads`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| POST | `/images` | Faz upload de imagem | ADMIN, SUPER_ADMIN | Multipart `file` (jpeg/png/webp), `assetType?` | `{ imageUrl: string, key: string }` |

Asset types suportados: `generic`, `logo`, `logo-light`, `logo-dark`, `favicon`, `banner-desktop`, `banner-mobile`, `product`, `social-image`, `default-product-image`, `totem-background`, `event-banner`, `event-logo`.

Aliases compativeis: `lightLogo`, `darkLogo`, `bannerDesktop`, `bannerMobile`, `socialImage`, `defaultProductImage`, `totemBackground`, `eventBanner`, `eventLogo`.

Limites por tipo:

| assetType | Limite | Saida |
|-----------|--------|-------|
| `generic` | 5 MB | WebP 1920x1920 |
| `logo`, `logo-light`, `logo-dark`, `event-logo` | 2 MB | WebP 512x512 |
| `favicon` | 512 KB | PNG 256x256 |
| `banner-desktop`, `event-banner` | 10 MB | WebP 1920x500 |
| `banner-mobile` | 8 MB | WebP 1080x600 |
| `product`, `default-product-image` | 5 MB | WebP 800x800 |
| `social-image` | 8 MB | WebP 1200x630 |
| `totem-background` | 10 MB | WebP 1920x1080 |

Exemplo:

```bash
curl -X POST "https://api.exemplo.com/uploads/images" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-organization-id: ORGANIZATION_ID" \
  -F "assetType=banner-desktop" \
  -F "file=@banner.png"
```

Resposta:

```json
{
  "imageUrl": "https://cdn.exemplo.com/organizations/org/assets/banner-desktop/v1/a1b2c3d4e5f6-id.webp",
  "key": "organizations/org/assets/banner-desktop/v1/a1b2c3d4e5f6-id.webp",
  "metadata": {
    "assetType": "banner-desktop",
    "width": 1920,
    "height": 500,
    "sizeInBytes": 123456,
    "contentType": "image/webp",
    "format": "webp",
    "aspectRatio": 3.84,
    "processedAt": "2026-07-13T12:00:00.000Z",
    "version": 1,
    "hash": "a1b2c3d4e5f6"
  }
}
```

Erros padronizados: `FILE_TOO_LARGE`, `INVALID_IMAGE_TYPE`, `INVALID_IMAGE`, `IMAGE_PROCESSING_FAILED`, `UPLOAD_FAILED`, `INVALID_ASSET_TYPE`.

### 6.17 Health (`/health`)

| Método | Rota | Objetivo | Permissões | Payload | Resposta |
|--------|------|----------|------------|---------|----------|
| GET | `/` | Health check da API | Público | - | `{ status: 'ok', message: 'API Running 🚀' }` |

---

## 7. Fluxos Principais

### 7.1 Fluxo de Pedido Online (Delivery)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant LS as Loja Online (Frontend)
    participant B as Backend
    participant P as Provedor de Pagamento (ex: Mercado Pago)
    participant I as Impressora

    %% Acesso a loja
    C->>LS: Acessa loja via link
    LS->>B: GET /online-stores/public/:slug
    B-->>LS: Dados da loja
    LS->>B: GET /online-stores/public/:slug/menu
    B-->>LS: Menu completo (categorias, produtos)
    
    %% Identificação do cliente (opcional)
    LS->>B: GET /online-stores/public/:slug/customers/by-phone?phone=...
    alt Cliente existe
        B-->>LS: Dados do cliente e endereços
    else Cliente novo
        B-->>LS: 404
    end
    
    %% Criação do pedido
    C->>LS: Seleciona produtos, endereço, método de pagamento
    LS->>B: POST /online-stores/public/:slug/orders
    B->>B: 🔐 Recalcula TODOS os valores usando dados do banco (NÃO confia no frontend!)
    B->>B: Cria Customer (se novo) e CustomerAddress
    B->>B: Cria OnlineOrder e OnlineOrderItems
    alt Pagamento via PIX automático
        B->>P: Cria pagamento PIX
        P-->>B: QR Code, copia e cola, id externo
        B->>B: Cria PaymentTransaction
    end
    B->>B: Emite evento via Socket.IO (para loja)
    B-->>LS: Pedido criado com sucesso!
    
    %% Atualização de status
    LS->>B: PATCH /online-stores/orders/:id/status (CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED)
    B->>B: Atualiza status do pedido
    B->>B: Emite evento via Socket.IO
    B-->>LS: Pedido atualizado
```

### 7.2 Fluxo de Pedido em Totem

```mermaid
sequenceDiagram
    participant C as Cliente
    participant T as Totem (Aplicativo)
    participant B as Backend
    participant I as Impressora
    
    %% Inicialização do dispositivo
    T->>B: POST /devices/activate (código de pareamento)
    B->>B: Cria token de dispositivo
    B-->>T: Token JWT do dispositivo
    
    %% Loop: Heartbeat
    loop A cada X segundos
        T->>B: POST /devices/heartbeat
        B->>B: Atualiza lastHeartbeatAt do dispositivo
    end
    
    %% Obtendo menu
    T->>B: GET /events/public/:slug
    B-->>T: Menu completo do evento
    
    %% Criação do pedido
    C->>T: Seleciona produtos
    T->>B: POST /orders/events/:eventId
    B->>B: 🔐 Recalcula valores usando dados do banco!
    B->>B: Cria Order e OrderItems
    B->>B: Cria EventPrintJob (se impressão automática estiver ativada)
    B->>B: Emite evento via Socket.IO (atualiza dashboard admin)
    B-->>T: Pedido criado com número
    
    %% Impressão
    loop Job de impressão a cada 3 segundos
        B->>I: Tenta enviar job para impressora (TCP/IP ou via dispositivo SK210)
        alt Impressão ok
            I-->>B: Confirmação
            B->>B: Atualiza status do job para PRINTED
        else Erro
            B->>B: Atualiza status do job para ERROR, registra mensagem de erro
        end
    end
    
    %% Tela de chamada
    T->>B: GET /orders/public/events/:eventId/call-screen
    B-->>T: Pedidos READY para retirada
```

### 7.3 Fluxo de Pedido com Cartão NFC

```mermaid
sequenceDiagram
    participant C as Cliente
    participant D as Dispositivo (Totem/SK210)
    participant B as Backend
    participant N as Cartão NFC
    
    %% Leitura do cartão
    D->>N: Aproxima cartão do leitor
    N-->>D: UID do cartão
    D->>B: POST /nfc-cards/identify { uid }
    B-->>D: Dados do cartão (incluindo saldo)
    
    %% Criação do pedido
    C->>D: Seleciona produtos
    D->>B: POST /orders/events/:eventId
    B-->>D: Pedido criado
    
    %% Pagamento com NFC
    D->>B: POST /nfc-cards/pay-order { orderId, uid }
    B->>B: Valida que cartão tem saldo suficiente
    B->>B: Cria NfcCardTransaction (PURCHASE)
    B->>B: Atualiza saldo do cartão
    B->>B: Atualiza status do pedido para PAID
    B->>B: Cria EventPrintJob
    B->>B: Emite evento via Socket.IO
    B-->>D: Pagamento realizado com sucesso!
```

---

## 8. Sistema de Organizações e Permissões

### 8.1 Hierarquia de Funções (UserRole)

| Role | Descrição | Permissões |
|------|-----------|------------|
| **SUPER_ADMIN** | Administrador global da plataforma | Acessar QUALQUER organização usando `x-organization-id`, gerenciar organizações e seus módulos, gerenciar outros super admins |
| **ADMIN** | Administrador da organização | Gerenciar eventos, catálogo, usuários da organização, dispositivos, impressoras, configurações, fechar eventos, ver relatórios |
| **OPERATOR** | Operador do dia-a-dia | Criar pedidos, atualizar status de pedidos, marcar pagamentos, usar cartões NFC, ver pedidos |

### 8.2 Impersonificação de Organização (Super Admin)

O SUPER_ADMIN pode acessar dados de QUALQUER organização usando o header `x-organization-id`.

**Como funciona:**
1. O SUPER_ADMIN envia o header `x-organization-id: <organization-id>` na requisição
2. O middleware `verify-jwt` extrai o `role` e `organizationId` do token
3. A função `getEffectiveOrganizationId()` é chamada no service/controle
4. Se o role for SUPER_ADMIN e o header existir, usa o ID da organização do header
5. Caso contrário, usa o `organizationId` do token do usuário

### 8.3 Função `getEffectiveOrganizationId()`

Localização: `src/lib/get-effective-organization-id.ts`

```typescript
export function getEffectiveOrganizationId(request: FastifyRequest): string {
  const userRole = request.user.role as UserRole
  const userOrgId = request.user.organizationId

  if (userRole === UserRole.SUPER_ADMIN) {
    const query = request.query as Record<string, string | undefined>
    const params = request.params as Record<string, string | undefined>

    // Primeiro tenta query parameter, depois params (para rotas aninhadas)
    const selectedOrgId = query.organizationId || params.organizationId

    if (selectedOrgId) {
      return selectedOrgId
    }
  }

  // Para ADMIN/OPERATOR, ou se nenhuma org selecionada por SUPER_ADMIN, usa org do token
  return userOrgId
}
```

### 8.4 Regras de Negócio Importantes (Isolamento de Dados)

**TODOS** os services/controles **DEVEM** usar `getEffectiveOrganizationId()` para filtrar dados por organização!

Exemplo:
```typescript
// ERRADO! Não filtra por organização!
const event = await prisma.event.findUnique({ where: { id } })

// CORRETO! Filtra por organizationId para garantir isolamento!
const effectiveOrgId = getEffectiveOrganizationId(request)
const event = await prisma.event.findUnique({
  where: { id, organizationId: effectiveOrgId }
})
```

---

## 9. Sistema de Módulos

### 9.1 Módulos Disponíveis

| Módulo | Chave (ModuleKey) | Descrição | Implementado? |
|--------|-------------------|-----------|---------------|
| Pedidos Online | `ONLINE_ORDERS` | Lojas online, delivery, clientes | ✅ Sim |
| Totem | `TOTEM` | Totens de autoatendimento para eventos | ✅ Sim |
| Eventos | `EVENTS` | Gerenciamento de eventos | ✅ Sim |
| Pagamentos | `PAYMENTS` | Integração com gateways de pagamento | ✅ Sim |
| Impressão | `PRINTING` | Impressão térmica de pedidos | ✅ Sim |
| NFC Cashless | `NFC_CASHLESS` | Cartões NFC para pagamentos sem dinheiro | ✅ Sim |
| Financeiro | `FINANCIAL` | Relatórios financeiros, fechamento de caixa | ✅ Sim |
| Dispositivos | `DEVICES` | Gerenciamento de dispositivos (totem, impressora, etc.) | ✅ Sim |
| Relatórios | `REPORTS` | Relatórios detalhados de vendas e pedidos | ✅ Sim |
| Delivery | `DELIVERY` | Funcionalidades específicas de delivery | ✅ Sim |
| WhatsApp | `WHATSAPP` | Integração com WhatsApp para notificações | ❌ Não |
| Fidelidade | `LOYALTY` | Programa de fidelidade para clientes | ❌ Não |

### 9.2 Como Habilitar/Desabilitar Módulos

Apenas SUPER_ADMIN pode habilitar/desabilitar módulos usando o endpoint:
```http
PATCH /super-admin/organizations/:organizationId/modules
Content-Type: application/json
Authorization: Bearer <super-admin-token>

{
  "modules": [
    { "moduleKey": "ONLINE_ORDERS", "enabled": true },
    { "moduleKey": "NFC_CASHLESS", "enabled": true },
    ...
  ]
}
```

### 9.3 Como o Backend Protege os Módulos

**Ainda não implementado!** Atualmente, os módulos são apenas informativos, mas a ideia é adicionar middlewares que bloqueiam rotas se o módulo não estiver habilitado para a organização.

---

## 10. Segurança

### 10.1 Autenticação JWT

- **Usuários**: Token JWT contendo `sub` (user id), `organizationId`, `role`, `email`
- **Dispositivos**: Token JWT contendo `deviceId`, `organizationId`, `eventId` (se vinculado a evento)
- **Validade**: Tokens expiram em 24h (padrão)
- **Armazenamento**: Senhas são armazenadas usando bcrypt (nunca em texto plano!)

### 10.2 Middlewares de Autenticação

#### `verify-jwt` (usuários)
- Valida token JWT no header `Authorization: Bearer <token>`
- Adiciona `request.user` com os dados do usuário
- Usado em todas as rotas protegidas (exceto públicas, auth, health)

#### `verify-super-admin`
- Verifica que `request.user.role === UserRole.SUPER_ADMIN`
- Usado em rotas exclusivas de super admins (`/super-admin/*`)

#### `try-verify-device-jwt` / `verify-device-jwt` (dispositivos)
- Valida token de dispositivo
- Adiciona `request.device` com os dados do dispositivo
- Usado em rotas de dispositivos (`/devices/heartbeat`, `/devices/config`, etc.)

### 10.3 Rate Limiting

Usamos `@fastify/rate-limit` para proteger a API de ataques de força bruta.

- **Chaves**:
  - Para rotas autenticadas: `user:<user-id>`
  - Para rotas públicas: `ip:<ip-address>`
- **Global desativado**: Configuramos rate limit por rota (ainda não implementado em todas as rotas)

### 10.4 CORS

Origens permitidas configuradas via variável `ALLOWED_ORIGINS` no `.env`, separadas por vírgula.

Exemplo:
```env
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173,https://app.defumarevents.com.br"
```

- **Desenvolvimento**: Todas as origens são permitidas (para facilitar o desenvolvimento)
- **Produção**: Apenas origens na whitelist são permitidas
- **Origens permitidas sem header**: Requisições sem `origin` (ex: curl, Insomnia, Postman, webhooks) são permitidas

### 10.5 Logs de Auditoria

**TODAS** as ações importantes são registradas na tabela `AuditLog` com:
- organizationId (sempre!)
- eventId (se aplicável)
- userId (se usuário autenticado)
- deviceId (se dispositivo)
- entity e entityId (qual entidade foi modificada)
- action (tipo da ação, ex: ORDER_CREATED)
- description (descrição legível por humanos)
- metadata (dados extras em JSON)
- createdAt (timestamp)

### 10.6 Cálculos Server-Side (Segurança Fundamental)

⚠️ **NUNCA** confie nos valores enviados pelo frontend! ⚠️

**TODOS** os cálculos de total de pedido, total de item, etc. **DEVEM** ser recalculados no backend usando apenas dados do banco de dados!

Exemplo de como é feito no `CreateOrderService`:
1. Recebe items do frontend (apenas `catalogProductId` e `quantity`)
2. Busca cada produto no banco de dados para obter `priceInCents` ATUAL
3. Calcula `unitPriceInCents` e `totalInCents` para cada item no backend
4. Soma todos os items para obter `totalInCents` do pedido
5. **NÃO USA NENHUM VALOR ENVIADO PELO FRONTEND PARA PREÇOS OU TOTAIS!**

---

## 11. Scripts Disponíveis

### 11.1 Scripts npm

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia servidor em modo desenvolvimento com hot reload (usando tsx watch) |
| `npm run db:seed` | Popula banco de dados com dados de teste (seed) |

### 11.2 Scripts Prisma

| Comando | Descrição |
|---------|-----------|
| `npx prisma generate` | Gera Prisma Client a partir do schema.prisma |
| `npx prisma migrate dev` | Cria e aplica migrações em desenvolvimento (modo interativo) |
| `npx prisma migrate deploy` | Aplica migrações em produção (seguro, não modifica schema) |
| `npx prisma migrate status` | Verifica status das migrações |
| `npx prisma studio` | Abre Prisma Studio (GUI para visualizar/editar dados) |
| `npx prisma db pull` | Puxa schema do banco de dados existente para schema.prisma |
| `npx prisma db push` | Aplica schema diretamente sem migrations (apenas para desenvolvimento!) |

### 11.3 Scripts Customizados

| Script | Descrição |
|--------|-----------|
| `npx tsx prisma/reset-user-password.ts <email> <nova-senha>` | Reseta senha de um usuário (útil se usuário esqueceu a senha) |
| `npx tsx prisma/audit-db.ts` | Faz auditoria do banco de dados (verifica tabelas, dados, etc.) |

---

## 12. Arquivos Importantes

| Arquivo | Localização | Descrição |
|---------|-------------|-----------|
| `.env` | `backend/` | Variáveis de ambiente (não commitado no git!) |
| `.env.example` | `backend/` | Exemplo de arquivo .env com todas as variáveis necessárias |
| `schema.prisma` | `backend/prisma/` | Schema do banco de dados (todas as models e enums) |
| `server.ts` | `backend/src/` | Ponto de entrada da aplicação, inicializa Fastify e Socket.IO |
| `app.ts` | `backend/src/` | Configura Fastify (plugins, CORS, rotas, jobs) |
| `prisma.ts` | `backend/src/lib/` | Instância singleton do Prisma Client |
| `get-effective-organization-id.ts` | `backend/src/lib/` | Lógica para resolver organizationId (considera impersonificação de super admin) |
| `socket.ts` | `backend/src/lib/` | Configuração do Socket.IO |
| `r2.ts` | `backend/src/lib/` | Integração com Cloudflare R2 para uploads |
| `logger.ts` | `backend/src/lib/` | Configuração do logger Pino |

---

## 13. Roadmap

### 13.1 Funcionalidades Já Implementadas ✅
- ✅ Multi-Tenant completo
- ✅ Autenticação e Autorização (JWT, RBAC)
- ✅ Gerenciamento de Eventos
- ✅ Catálogo de Produtos e Categorias
- ✅ Pedidos de Eventos
- ✅ Pagamentos (PIX Manual, PIX Automático Mercado Pago, Dinheiro, Cartão, NFC)
- ✅ Impressão Térmica (TCP/IP e Gertec SK210)
- ✅ Totens de Autoatendimento
- ✅ Cartões NFC para Pagamentos Cashless
- ✅ Lojas Online (Delivery)
- ✅ Logs de Auditoria Completos
- ✅ Socket.IO para Atualizações em Tempo Real
- ✅ Upload de Imagens para Cloudflare R2
- ✅ Fechamento de Caixa de Eventos
- ✅ Métricas e Relatórios Básicos
- ✅ Gerenciamento de Dispositivos
- ✅ Super Admin e Impersonificação de Organizações

### 13.2 Funcionalidades Pendentes ⏳
- ⏳ Integração com WhatsApp para Notificações
- ⏳ Programa de Fidelidade (LOyalty)
- ⏳ Relatórios Mais Detalhados e Exportáveis (PDF, Excel)
- ⏳ Integração com Mais Provedores de Pagamento (PagSeguro, Cielo, GetNet, Stone)
- ⏳ Cache com Redis para Melhorar Desempenho
- ⏳ Middleware de Proteção a Módulos (bloquear rotas se módulo não estiver habilitado)
- ⏳ Testes Automatizados (Unitários e E2E)
- ⏳ CI/CD (GitHub Actions, GitLab CI, etc.)
- ⏳ Dockerização da Aplicação
- ⏳ Monitoramento e Alertas (Prometheus, Grafana, Sentry)
- ⏳ Backup Automático do Banco de Dados
- ⏳ Painel de Analytics para Super Admin

---

## 14. Melhorias Futuras

### 14.1 Alta Prioridade 🔴
1. **Integração com WhatsApp**: Enviar notificações de pedido para clientes (ex: "Seu pedido saiu para entrega!")
2. **Programa de Fidelidade**: Pontos por compra, cupons, descontos
3. **Relatórios Exportáveis**: Exportar relatórios para PDF, Excel, CSV
4. **Middleware de Proteção a Módulos**: Bloquear rotas se o módulo não estiver habilitado para a organização

### 14.2 Média Prioridade 🟡
1. **Integração com Mais Provedores**: PagSeguro, Cielo, GetNet, Stone
2. **Cache com Redis**: Cachear menus, métricas, dados frequentes para melhorar desempenho
3. **Notificações Push**: Enviar notificações push para dispositivos (totens, SK210)
4. **Gestão de Estoque Avançada**: Controle de estoque mais robusto, alertas de estoque baixo

### 14.3 Baixa Prioridade 🟢
1. **Painel de Analytics para Super Admin**: Dados globais da plataforma
2. **Testes Automatizados**: Unitários, integração, E2E
3. **CI/CD**: Automatizar deploy da aplicação
4. **Dockerização**: Facilitar deploy e desenvolvimento
5. **Monitoramento e Alertas**: Prometheus, Grafana, Sentry

---

## 15. Como Executar o Projeto

### 15.1 Pré-requisitos
- Node.js 20+
- npm ou yarn
- PostgreSQL 14+ (rodando localmente ou em serviço como Docker, Supabase, Neon, etc.)
- Cloudflare R2 (ou S3 compatible) para uploads de imagens (opcional para desenvolvimento)
- Conta no Mercado Pago (opcional para pagamento PIX automático)

### 15.2 Passo-a-Passo

1. **Clone o repositório (se aplicável)**
   ```bash
   cd pasta-do-projeto
   ```

2. **Instale as dependências**
   ```bash
   cd backend
   npm install
   ```

3. **Configure as variáveis de ambiente**
   - Copie o arquivo `.env.example` para `.env`
   - Edite o `.env` e preencha todas as variáveis
   ```bash
   cp .env.example .env
   # Edite o arquivo .env com seus dados!
   ```

   **Variáveis mínimas necessárias para desenvolvimento:**
   ```env
   DATABASE_URL="postgresql://seu-usuario:senha@localhost:5432/nome-do-banco?schema=public"
   JWT_SECRET="uma-senha-super-secreta-aqui-mude-isso-em-producao!"
   PORT="3333"
   ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
   NODE_ENV="development"
   ```

4. **Gere o Prisma Client e aplique as migrações**
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

5. **Popule o banco com dados de teste (opcional)**
   ```bash
   npm run db:seed
   ```

6. **Inicie o servidor em modo desenvolvimento**
   ```bash
   npm run dev
   ```

7. **Pronto!** 🚀
   - API rodando em `http://localhost:3333`
   - Prisma Studio (se quiser visualizar dados): `npx prisma studio` (abre em `http://localhost:5555`)

### 15.3 Variáveis de Ambiente Completas

| Variável | Descrição | Obrigatória? |
|----------|-----------|--------------|
| `DATABASE_URL` | URL de conexão com o PostgreSQL | Sim |
| `JWT_SECRET` | Chave secreta para assinar tokens JWT | Sim |
| `PORT` | Porta do servidor (padrão: 3333) | Não |
| `ALLOWED_ORIGINS` | Origens permitidas para CORS | Não |
| `NODE_ENV` | Ambiente: `development`, `production` | Não |
| `R2_ACCOUNT_ID` | Account ID do Cloudflare R2 | Não |
| `R2_ACCESS_KEY_ID` | Access Key ID do Cloudflare R2 | Não |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key do Cloudflare R2 | Não |
| `R2_BUCKET_NAME` | Nome do bucket no Cloudflare R2 | Não |
| `R2_PUBLIC_URL` | URL pública do bucket R2 | Não |
| `MERCADO_PAGO_ACCESS_TOKEN` | Access Token do Mercado Pago | Não |

---

## 16. Guia Rápido para Desenvolvedores

### 16.1 Adicionar uma Nova Rota
1. Crie o service em `src/modules/<modulo>/services/<nome>-service.ts`
2. Crie o controller em `src/modules/<modulo>/controllers/<nome>-controller.ts`
3. Crie o schema (se precisar) em `src/modules/<modulo>/schemas/<nome>-schema.ts`
4. Adicione a rota em `src/modules/<modulo>/routes/<modulo>-routes.ts`
5. Registre as rotas no `src/app.ts`

### 16.2 Adicionar uma Nova Migration
1. Edite o arquivo `prisma/schema.prisma`
2. Execute `npx prisma migrate dev --name nome-da-migration`
3. Verifique a migration gerada em `prisma/migrations/`
4. Aplique as migrações: `npx prisma migrate deploy` (produção)

### 16.3 Boas Práticas
- **Sempre use `getEffectiveOrganizationId()`** para filtrar dados por organização!
- **Sempre recalcula valores no backend** (não confie no frontend para preços!)
- **Sempre registre logs de auditoria** para ações importantes!
- **Use Zod para validar TODOS os dados de entrada**!
- **Use tipos Prisma gerados automaticamente** (não crie tipos manualmente para models!)

---

## 17. Contato e Suporte

Para dúvidas, problemas ou sugestões, entre em contato com a equipe de desenvolvimento.

---

**Fim do README Enterprise da Defumar Events Platform - Backend** ✨
