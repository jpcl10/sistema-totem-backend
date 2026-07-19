# Redis e BullMQ no EasyPanel

Nesta etapa, Redis deve rodar como serviço separado. Nao adicione Redis dentro do container da API.

## Servico Redis

- Imagem: `redis:7`
- Porta interna: `6379`
- Porta publica: desabilitada
- Volume persistente: `/data`
- Comando sugerido:

```sh
redis-server --appendonly yes --appendfsync everysec --requirepass SENHA_FORTE --maxmemory 256mb --maxmemory-policy noeviction
```

## Variaveis da API

Exemplo sanitizado:

```env
REDIS_ENABLED=true
REDIS_URL=redis://:SENHA_FORTE@redis:6379
REDIS_KEY_PREFIX=defumar:production
REDIS_CONNECT_TIMEOUT_MS=10000
REDIS_MAX_RETRIES_PER_REQUEST=2

PRINT_PROCESSING_MODE=BULLMQ
PRINT_REDIS_FAILURE_GRACE_MS=30000
PRINT_QUEUE_CONCURRENCY=2
PRINT_JOB_TIMEOUT_MS=30000
PRINT_JOB_STALE_LOCK_MS=120000
PRINT_LEGACY_POLLING_INTERVAL_MS=3000
```

Nunca exponha `REDIS_URL` completa em logs, tickets ou prints. O backend redige campos conhecidos, mas a URL deve continuar restrita ao ambiente.

## Comportamento

- Com Redis saudavel: impressao usa BullMQ e o polling legado fica desligado.
- Com Redis indisponivel: o backend aguarda `PRINT_REDIS_FAILURE_GRACE_MS`, confirma a falha, encerra BullMQ local e so entao liga o polling legado.
- Quando Redis recupera: o backend desliga o polling, aguarda execucao em andamento, religa BullMQ e reconcilia jobs pendentes do PostgreSQL.

O PostgreSQL continua sendo a fonte oficial do estado dos jobs de impressao.
