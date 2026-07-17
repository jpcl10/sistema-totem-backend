# Domain Migration Backend

Data: 2026-07-16

## Referencias encontradas

Runtime/producao:

- `src/lib/cors.ts`: tinha `https://app.defumarevents.com.br` hardcoded como origem default. Alterado para env.
- `src/lib/socket.ts`: Socket.IO usava a mesma validacao de CORS. Alterado para aceitar `SOCKET_ALLOWED_ORIGINS` com fallback para CORS.
- `src/modules/uploads/controllers/upload-image-controller.ts`: usa `R2_PUBLIC_URL` para montar `imageUrl`.
- `src/shared/utils/r2-url-schema.ts`: valida URLs persistidas contra `R2_PUBLIC_URL`.
- `src/modules/devices/services/get-device-config-service.ts`: nao entregava URL publica. Agora entrega bases opcionais em `config.publicUrls`.
- `src/shared/config/mercado-pago.ts`: le `MERCADO_PAGO_WEBHOOK_URL`, mas o webhook real do backend continua em `/webhooks/mercado-pago`.

Desenvolvimento/scripts:

- `scripts/test-cors.ts`: usava `https://app.defumarevents.com.br`. Alterado para ler env.
- `prisma/seed.ts`: usa e-mail `superadmin@defumarevents.com.br`. Nao alterado para nao quebrar seed/login local sem confirmacao.

Documentacao:

- `README.md`: exemplos antigos de `ALLOWED_ORIGINS` e localhost.
- `docs/go-live/guellos-backend-readiness.md`: exemplos antigos de dominio API/frontend.
- `README-FRONT.MD`: exemplos genericos de `VITE_API_URL`.

Ngrok:

- Nao foi encontrada referencia a `ngrok-free.dev` ou `city-obtrusive-sudden`.
- Header `ngrok-skip-browser-warning` permanece permitido para desenvolvimento/teste.

## Variaveis

Novas/preparadas em `.env.example`:

```env
FRONTEND_URL="<NOVO_FRONTEND_URL>"
API_PUBLIC_URL="<NOVA_API_URL>"
SOCKET_PUBLIC_URL="<NOVA_API_URL>"
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173,<NOVO_FRONTEND_URL>"
SOCKET_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173,<NOVO_FRONTEND_URL>"
ALLOW_LOVABLE_ORIGINS="true"
R2_PUBLIC_URL="https://pub-xxxxx.r2.dev"
```

Compatibilidade:

- `ALLOWED_ORIGINS` continua aceito como fallback legado.
- Ordem de leitura: `CORS_ALLOWED_ORIGINS` -> `ALLOWED_ORIGINS` -> `FRONTEND_URL`.
- Socket: `SOCKET_ALLOWED_ORIGINS` -> `CORS_ALLOWED_ORIGINS` -> `ALLOWED_ORIGINS` -> `FRONTEND_URL`.

## CORS

Arquivo: `src/lib/cors.ts`

Regras:

- Lista separada por virgula.
- `trim` e normalizacao por `new URL(origin).origin`.
- Sem wildcard.
- Origins desconhecidas bloqueadas.
- Requests sem `Origin` continuam permitidas para server-to-server, devices, curl e webhooks.
- Localhost entra automaticamente somente fora de producao.
- Lovable entra automaticamente fora de producao; em producao precisa `ALLOW_LOVABLE_ORIGINS=true`.
- Dominio antigo deve entrar temporariamente via env, nao em codigo.

Exemplo temporario de migracao:

```env
CORS_ALLOWED_ORIGINS=https://app.defumarevents.com.br,<NOVO_FRONTEND_URL>
SOCKET_ALLOWED_ORIGINS=https://app.defumarevents.com.br,<NOVO_FRONTEND_URL>
```

Remover `https://app.defumarevents.com.br` da env apos a janela de transicao.

## Socket.IO

Arquivo: `src/lib/socket.ts`

- Usa `validateSocketCorsOrigin`.
- Mesma politica da lista oficial, com override por `SOCKET_ALLOWED_ORIGINS`.
- Nao usa `*` com credenciais.
- Rooms autenticadas continuam:
  - `organization:<organizationId>`
  - `event:<eventId>`
- Rooms publicas de chamada continuam:
  - `call-screen:store:<storeId>`
  - `call-screen:event:<eventId>`

## URLs publicas

Arquivo: `src/lib/public-urls.ts`

Funcoes:

- `getFrontendUrl()`
- `getApiPublicUrl()`
- `getSocketPublicUrl()`

Uso atual:

- `src/modules/devices/services/get-device-config-service.ts`
  - `config.publicUrls.apiBaseUrl`
  - `config.publicUrls.socketUrl`
  - `config.publicUrls.frontendUrl`

Nao foram inventados paths de frontend para cardapio, Totem ou Tela de Chamada. O Lovable deve montar paths com base no contrato final do frontend.

## R2 e assets

Variavel:

- `R2_PUBLIC_URL`

Impacto:

- Uploads novos retornam `imageUrl = R2_PUBLIC_URL/key`.
- URLs antigas ja persistidas no banco nao sao alteradas.
- `r2UrlSchema` valida novas URLs contra o `R2_PUBLIC_URL` atual.

Se o dominio de assets mudar:

- manter dominio antigo valido temporariamente; ou
- configurar redirect/CDN; e
- planejar backfill de URLs persistidas somente depois de validacao.

## Rotas publicas

Paths nao dependem do dominio:

- `/public/stores/:slug`
- `/public/call-screens/store/:slug`
- `/public/call-screens/store/:slug/orders`
- `/public/call-screens/event/:slug`
- `/public/call-screens/event/:slug/orders`
- `/public/events/:slug`
- `/public/events/:slug/orders`
- `/public/events/:slug/call-screen-orders`
- `/uploads/images`
- `/orders/unified`
- `/webhooks/mercado-pago`

A troca deve afetar host/origin, nao paths.

## Devices

Auditoria:

- `GetDeviceConfigService` entregava IDs/slugs/configuracao, mas nao URL base.
- Agora entrega bases publicas opcionais em `config.publicUrls`.

Devices que podem precisar reconfiguracao externa:

- `TOTEM`: apontar WebView/API para novo frontend/API.
- `CALL_SCREEN`: apontar WebView para novo frontend.
- `PRINTER`, `SK210`: se usam API/Socket diretamente fora do config, atualizar app/config instalado.

## Integracoes externas

Mercado Pago:

- Webhook backend: `/webhooks/mercado-pago`.
- URL final para painel: `<NOVA_API_URL>/webhooks/mercado-pago`.
- `MERCADO_PAGO_WEBHOOK_SECRET` nao muda automaticamente.
- `PaymentProviderSettings.webhookUrl` pode conter URL antiga por tenant; auditar no banco/admin antes do Go-Live.

WhatsApp/notificacoes:

- Nao foram encontradas URLs absolutas de dominio no backend.

R2:

- Atualizar `R2_PUBLIC_URL` apenas se o dominio publico de assets mudar.

OAuth/deep links:

- Nao foram encontrados fluxos OAuth/deep links no backend.

## Proxy e Nginx

Checklist:

- DNS `A/AAAA` de `<NOVA_API_URL>` para a VPS/load balancer.
- TLS valido para API e frontend.
- Nginx passa:
  - `Host`
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`
- Socket.IO upgrade habilitado:
  - `proxy_http_version 1.1`
  - `Upgrade`
  - `Connection "upgrade"`
- Liberar path `/socket.io/`.
- Healthcheck em `/health` e `/`.
- Configurar `NODE_ENV=production`.
- Preencher `CORS_ALLOWED_ORIGINS` e `SOCKET_ALLOWED_ORIGINS` sem localhost em producao.

## Riscos

- URLs de imagem ja persistidas podem quebrar se o dominio R2 antigo sair do ar.
- Apps de device instalados podem ter API/WebView hardcoded fora do backend.
- Webhook Mercado Pago precisa ser atualizado no painel externo.
- `PaymentProviderSettings.webhookUrl` pode conter URL antiga salva no banco.
- `prisma/seed.ts` ainda usa e-mail com dominio antigo para superadmin local.
- Documentacao antiga ainda contem exemplos de `defumarevents.com.br`.

## Validacao executada

- `npx.cmd tsc --noEmit`
- `npm.cmd test`
- `npx.cmd prisma validate`

Todos passaram em 2026-07-16.
