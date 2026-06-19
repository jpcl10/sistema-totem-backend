# Sistema Totem Backend

Backend profissional do sistema de eventos e totem de autoatendimento, voltado para bares, festas e operações com pedidos em tempo real. O projeto atende tanto o fluxo público do totem quanto o painel administrativo, integrando pagamentos, impressão, dispositivos e atualização em tempo real via Socket.IO.

## 1. Visão Geral do Projeto

Este backend centraliza:
- Sistema multi-tenant por organização
- Totem de autoatendimento com menu público
- Painel administrativo completo
- Pedidos em tempo real com controle de estoque
- Pagamento PIX automático via Mercado Pago
- Impressão automática por setor ou pedido completo
- Controle de dispositivos (totem, impressora, tela de chamada, SK210)
- Upload de imagens com Cloudflare R2
- Audit Logs completo para auditoria
- Health check completo
- Rate limiting e segurança avançada

Fluxo operacional principal:
1. O cliente acessa o menu público do evento.
2. O totem cria o pedido.
3. O backend registra o pedido, gerencia estoque e emite eventos em tempo real.
4. O pagamento segue por fluxo manual ou PIX automático com expiração configurável.
5. Quando o pagamento é confirmado (via webhook ou manualmente), os jobs de impressão são criados.
6. Impressoras TCP/IP ou dispositivos SK210 processam a fila.
7. Todo o ciclo é registrado em Audit Logs para auditoria.

## 2. Tecnologias Utilizadas

| Tecnologia | Uso no Projeto |
|------------|----------------|
| Node.js | Runtime da aplicação |
| TypeScript | Tipagem e organização do código |
| Fastify | Servidor HTTP de alta performance |
| Prisma | ORM e acesso ao banco de dados |
| PostgreSQL | Banco de dados principal |
| Socket.IO | Atualização em tempo real por evento |
| JWT | Autenticação de usuários e dispositivos |
| Zod | Validação de payloads |
| Mercado Pago SDK | PIX automático e consulta de pagamentos |
| Cloudflare R2 | Armazenamento de imagens |
| AWS SDK S3 | Integração com o bucket R2 |
| @fastify/multipart | Upload de arquivos |
| @fastify/rate-limit | Rate limiting para segurança |
| @fastify/cors | Controle de origens permitidas |
| Pino | Logs estruturados e performáticos |

## 3. Arquitetura de Módulos

Estrutura principal do backend:

```text
backend/
├─ prisma/
│  ├─ migrations/          # Migrations do banco de dados
│  └─ schema.prisma        # Schema do Prisma
├─ src/
│  ├─ @types/              # Tipagens TypeScript
│  ├─ jobs/                # Jobs periódicos (expiração de PIX, etc.)
│  ├─ lib/                 # Libs e drivers compartilhados
│  │  ├─ printers/         # Drivers de impressão (Gertec SK210, TCP)
│  │  ├─ logger.ts         # Configuração do logger Pino
│  │  ├─ prisma.ts         # Cliente Prisma
│  │  ├─ r2.ts             # Integração com Cloudflare R2
│  │  ├─ socket.ts         # Configuração do Socket.IO
│  │  └─ thermal-printer.ts# Gerador de comandos ESC/POS
│  ├─ modules/             # Módulos da aplicação
│  │  ├─ audit-logs/       # Logs de auditoria
│  │  ├─ auth/             # Autenticação JWT
│  │  ├─ catalog/          # Catálogo (categorias, produtos, produtos por evento)
│  │  ├─ device-print-jobs/# Jobs de impressão por dispositivo
│  │  ├─ devices/          # Gestão de dispositivos
│  │  ├─ events/           # Eventos, menu público, fechamento
│  │  ├─ health/           # Health check completo
│  │  ├─ metrics/          # Métricas do evento
│  │  ├─ orders/           # Pedidos
│  │  ├─ payment-provider-settings/# Configuração de provedores de pagamento
│  │  ├─ payments/         # Pagamentos, webhooks, PIX
│  │  ├─ print-jobs/       # Fila de impressão
│  │  ├─ printers/         # Impressoras do evento
│  │  ├─ uploads/          # Upload de imagens
│  │  └─ users/            # Usuários
│  └─ app.ts               # Arquivo principal da aplicação
├─ .env.example            # Exemplo de variáveis de ambiente
├─ package.json
└─ tsconfig.json
```

## 4. Funcionalidades Principais

- **Autenticação JWT**: Para usuários do painel administrativo e dispositivos
- **Multi-tenant por Organização**: Isolamento completo de dados por organização
- **Eventos**: Criação, arquivamento, fechamento e reabertura de eventos
- **Catálogo**: Categorias e produtos base, com vinculação a eventos
- **Produtos por Evento**: Preço, estoque, disponibilidade e setor por evento
- **Pedidos**: Criação, status operacional, status de pagamento e resumo financeiro
- **PIX Automático Mercado Pago**: Geração de QR Code, expiração e confirmação via webhook
- **Webhook Mercado Pago**: Validação de assinatura e idempotência com `x-request-id`
- **Expiração Automática de PIX**: Job periódico que expira PIX pendentes
- **Cancelamento Automático de Pedidos**: Pedidos com PIX expirado são cancelados automaticamente
- **Impressão de Pedidos**: Impressão automática ou manual por pedido completo ou setor
- **Dispositivos**: Controle de totens, impressoras, telas de chamada e SK210
- **Upload de Imagens**: Integração com Cloudflare R2 para armazenamento de imagens
- **Audit Logs Completo**: Registro de todas as ações importantes para auditoria
- **Tela/API de Atividades**: Visualização de logs de auditoria por evento
- **Rate Limiting**: Proteção contra abusos de API
- **CORS Restrito**: Controle de origens permitidas
- **Health Check Completo**: Verificação de status do servidor, banco de dados, etc.
- **Logs Estruturados com Pino**: Logs performáticos com censura de dados sensíveis
- **Proteção Contra Concorrência**: Garantia de unicidade de orderNumber por evento e controle de estoque

## 5. Variáveis de Ambiente

Crie um arquivo `.env` na pasta `backend/` baseado no `.env.example`.

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public"

PORT=3333

JWT_SECRET="sua-chave-jwt-segura"

ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173,https://defumar.lovable.app"

R2_ACCOUNT_ID="seu-account-id-cloudflare"
R2_ACCESS_KEY_ID="sua-access-key-id"
R2_SECRET_ACCESS_KEY="sua-secret-access-key"
R2_BUCKET_NAME="totem-images"
R2_PUBLIC_URL="https://pub-xxxxx.r2.dev"

MERCADO_PAGO_ACCESS_TOKEN="seu-access-token"
MERCADO_PAGO_PUBLIC_KEY="sua-public-key"
MERCADO_PAGO_WEBHOOK_SECRET="seu-webhook-secret"
MERCADO_PAGO_WEBHOOK_URL="https://seu-backend.com/webhooks/mercado-pago"

NODE_ENV="development"
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | String de conexão do PostgreSQL usada pelo Prisma |
| `PORT` | Não (padrão: 3333) | Porta onde o servidor HTTP irá rodar |
| `JWT_SECRET` | Sim | Segredo usado para assinar JWT de usuários e dispositivos |
| `ALLOWED_ORIGINS` | Sim | Lista de origens permitidas para CORS, separadas por vírgula |
| `MERCADO_PAGO_ACCESS_TOKEN` | Sim para PIX automático | Token privado de integração com Mercado Pago |
| `MERCADO_PAGO_PUBLIC_KEY` | Recomendado para frontend | Chave pública usada no checkout |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Recomendado | Segredo para validar o webhook do Mercado Pago |
| `MERCADO_PAGO_WEBHOOK_URL` | Recomendado | URL pública configurada no Mercado Pago para receber webhooks |
| `R2_ACCOUNT_ID` | Sim para upload | Account ID do Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Sim para upload | Access key do bucket R2 |
| `R2_SECRET_ACCESS_KEY` | Sim para upload | Secret key do bucket R2 |
| `R2_BUCKET_NAME` | Sim para upload | Nome do bucket usado para imagens |
| `R2_PUBLIC_URL` | Sim para URLs públicas | URL pública do bucket R2 |
| `NODE_ENV` | Não (padrão: development) | Ambiente de execução (development ou production) |

## 6. Como Rodar Localmente

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure o arquivo `.env` com suas credenciais

3. Execute as migrations do Prisma:
   ```bash
   npx prisma migrate dev
   ```

4. Gere o cliente Prisma:
   ```bash
   npx prisma generate
   ```

5. Inicie o servidor em modo desenvolvimento:
   ```bash
   npm run dev
   ```

O servidor HTTP irá subir na porta `3333`.

## 7. Como Rodar Migrations do Prisma

- **Criar uma nova migration**:
  ```bash
  npx prisma migrate dev --name nome-da-migration
  ```

- **Aplicar migrations em desenvolvimento**:
  ```bash
  npx prisma migrate dev
  ```

- **Aplicar migrations em produção**:
  ```bash
  npx prisma migrate deploy
  ```

- **Abrir o Prisma Studio** (interface para visualizar o banco de dados):
  ```bash
  npx prisma studio
  ```

## 8. Como Testar Health Check

O health check está disponível em:

```http
GET /health
```

Ele retorna o status do servidor, conexão com o banco de dados e outras informações relevantes.

## 9. Como Funciona Upload R2

O upload de imagens é feito via Cloudflare R2. A rota de upload é:

```http
POST /uploads/images
```

Esta rota recebe um arquivo via `multipart/form-data`, faz o upload para o bucket R2 e retorna a URL pública da imagem.

## 10. Como Funciona PIX/Mercado Pago

### Fluxo Completo
1. O totem cria o pedido em `POST /public/events/:slug/orders`
2. O backend cria ou reaproveita uma transação PIX no checkout público
3. O Mercado Pago gera o QR Code e os dados de cópia e cola
4. O backend salva a `PaymentTransaction` com `expiresAt`
5. O totem exibe o QR Code com contador
6. O cliente realiza o pagamento
7. O Mercado Pago chama o webhook configurado
8. O backend valida a assinatura do webhook, verifica idempotência via `x-request-id` e consulta o pagamento real no Mercado Pago
9. O pedido passa para `PAID`
10. Um `PrintJob` é criado
11. A impressora TCP/IP ou o dispositivo SK210 executa a impressão
12. O Socket.IO atualiza as telas operacionais e públicas

### Webhook Mercado Pago
Rota do webhook:
```http
POST /webhooks/mercado-pago
```

Configure no painel Mercado Pago Developers uma URL pública acessível pela internet. Durante desenvolvimento local, use um tunel como `ngrok`.

### Expiração de PIX
- O campo `Event.pixPaymentExpirationMinutes` define o tempo de validade do PIX por evento (padrão: 5 minutos)
- O job `expire-pending-pix-job` verifica transações vencidas a cada 30 segundos
- Quando um PIX vence, a transação é marcada como `EXPIRED` e o pedido é cancelado automaticamente

## 11. Como Funciona Auditoria/Audit Logs

O sistema registra todas as ações importantes em `AuditLog` para auditoria completa. As logs incluem:
- Ação realizada
- Usuário ou dispositivo que realizou a ação
- Data e hora
- Dados relevantes da ação
- ID do evento relacionado

A rota para visualizar os logs de auditoria por evento é:
```http
GET /events/:eventId/audit-logs
```

## 12. Como Funciona Rate Limiting

O rate limiting é configurado com `@fastify/rate-limit` e é aplicado por rota. A chave de rate limiting é:
- Para rotas autenticadas: ID do usuário
- Para rotas públicas: IP do cliente

Isso protege a API contra abusos e ataques de força bruta.

## 13. Como Funciona CORS

O CORS é configurado com `@fastify/cors` e permite apenas origens listadas em `ALLOWED_ORIGINS`. Requisições sem origem (como Insomnia, Postman ou webhooks) são permitidas.

## 14. Como Funciona Impressão

O backend suporta dois caminhos principais de impressão:
- `TCP_IP`: Impressão automática pela rede
- `SK210_LOCAL`: Impressão local intermediada por app/dispositivo

Conceitos importantes:
- `EventPrintJob` representa cada item da fila de impressão
- A impressão automática acontece após pagamento confirmado
- O evento pode operar em `FULL_ORDER`, `BY_SECTOR` ou `BOTH`
- O worker de impressão roda a cada 3 segundos

## 15. Como Funciona Dispositivos

O módulo de dispositivos cobre:
- Device token JWT para autenticação do equipamento
- Ativação de dispositivo por `code` e `secret`
- Heartbeat periódico para atualizar `lastHeartbeatAt` e `lastSeenAt`
- Impressão local via SK210
- Fila de impressão por dispositivo
- Controle de status como `ACTIVE`, `PAUSED`, `OFFLINE` e `MAINTENANCE`

Tipos de dispositivo suportados:
- `TOTEM`
- `PRINTER`
- `CALL_SCREEN`
- `SK210`

## 16. Segurança Implementada

- **Autenticação JWT**: Para usuários e dispositivos
- **CORS Restrito**: Apenas origens permitidas
- **Rate Limiting**: Proteção contra abusos
- **Logs Estruturados**: Censura de dados sensíveis (senhas, tokens, etc.)
- **Validação de Assinatura do Webhook**: Garante que o webhook veio do Mercado Pago
- **Idempotência do Webhook**: Evita processamento duplicado via `x-request-id`
- **Proteção Contra Concorrência**: Garantia de unicidade de orderNumber e controle de estoque

## 17. Comandos Úteis

```bash
npm run dev              # Inicia o servidor em modo desenvolvimento
npx prisma studio        # Abre o Prisma Studio
npx prisma migrate dev   # Cria e aplica migrations em desenvolvimento
npx prisma migrate deploy# Aplica migrations em produção
npx prisma generate      # Gera o cliente Prisma
npx tsc --noEmit         # Verifica erros de TypeScript
```

## 18. Estrutura de Pastas

A estrutura de pastas segue uma arquitetura modular, onde cada módulo tem seus próprios controllers, services, routes e schemas. Isso facilita a manutenção e a escalabilidade do projeto.

## 19. Checklist para Produção/VPS

- [ ] Configurar variáveis de ambiente com valores seguros
- [ ] Aplicar migrations com `npx prisma migrate deploy`
- [ ] Configurar CORS com origens de produção
- [ ] Configurar webhook do Mercado Pago com URL pública
- [ ] Configurar Cloudflare R2 com bucket de produção
- [ ] Configurar logs estruturados e monitoramento
- [ ] Configurar SSL/TLS (HTTPS)
- [ ] Configurar backup do banco de dados PostgreSQL
- [ ] Testar fluxo completo de pagamento PIX
- [ ] Testar impressão automática
- [ ] Testar health check

## 20. Roadmap Técnico Futuro

- **BullMQ/Redis**: Para gerenciamento de jobs e filas mais robusto
- **Comandas**: Suporte a comandas físicas
- **Cashless**: Integração com sistemas de cashless
- **NFC**: Leitura de cartões NFC
- **Mercado Pago Point**: Integração com terminais de cartão Mercado Pago Point
- **Testes Automatizados**: Testes unitários e de integração

---

**Nota**: Nunca commite o arquivo `.env` real no repositório. Sempre use o `.env.example` como referência.
