# Plano de Migração - Unificação do Catálogo

## 1. Visão Geral

**Objetivo**: Eliminar a duplicação de catálogos e unificar todos os produtos na fonte única `CatalogCategory` e `CatalogProduct`, removendo `OnlineCategory` e `OnlineProduct` a longo prazo.

---

## 2. Situação Atual - Arquitetura de Dados

### 2.1 Modelos Obsoletos (a remover futuramente)
- `OnlineCategory`: Categorias específicas de loja online
- `OnlineProduct`: Produtos específicos de loja online
- Relações:
  - `OnlineCategory` → `OnlineStore` (storeId)
  - `OnlineProduct` → `OnlineStore` (storeId) + `OnlineCategory` (categoryId)
  - `OnlineOrderItem` → `OnlineProduct` (productId)

### 2.2 Modelos Padrão (mantidos)
- `CatalogCategory`: Categorias padrão da organização
- `CatalogProduct`: Produtos padrão da organização
- Relações:
  - `CatalogCategory` → `Organization`
  - `CatalogProduct` → `Organization` + `CatalogCategory`
  - `OnlineOrderItem` **já possui** `catalogProductId`! ✅

---

## 3. Arquivos e Dependências Identificadas

### 3.1 Arquivos do Módulo Online-Stores

| Arquivo | Tipo | Usos de `OnlineCategory`/`OnlineProduct` | Observações |
|---------|------|------------------------------------------|-------------|
| [create-online-store-service.ts](file:///c:/Users/João%20Pedro/Desktop/SISTEMA%20DEFUMAR/backend/src/modules/online-stores/services/create-online-store-service.ts) | Serviço | Nenhum | ✅ OK - já usa apenas `OnlineStore` |
| [update-online-store-service.ts](file:///c:/Users/João%20Pedro/Desktop/SISTEMA%20DEFUMAR/backend/src/modules/online-stores/services/update-online-store-service.ts) | Serviço | Nenhum | ✅ OK - já usa apenas `OnlineStore` |
| [get-online-store-service.ts](file:///c:/Users/João%20Pedro/Desktop/SISTEMA%20DEFUMAR/backend/src/modules/online-stores/services/get-online-store-service.ts) | Serviço | Nenhum | ✅ OK - já usa `CatalogCategory`/`CatalogProduct`! |
| [get-public-store-service.ts](file:///c:/Users/João%20Pedro/Desktop/SISTEMA%20DEFUMAR/backend/src/modules/online-stores/services/get-public-store-service.ts) | Serviço | Nenhum | ✅ OK - já usa `CatalogCategory`/`CatalogProduct`! |
| [create-online-order-service.ts](file:///c:/Users/João%20Pedro/Desktop/SISTEMA%20DEFUMAR/backend/src/modules/online-stores/services/create-online-order-service.ts) | Serviço | Nenhum | ✅ OK - já usa `CatalogProduct` e `catalogProductId`! |
| [list-online-orders-service.ts](file:///c:/Users/João%20Pedro/Desktop/SISTEMA%20DEFUMAR/backend/src/modules/online-stores/services/list-online-orders-service.ts) | Serviço | Nenhum | ✅ OK - usa `OnlineOrder`/`OnlineOrderItem` (mas `OnlineOrderItem` já tem `catalogProductId`) |
| [update-online-order-status-service.ts](file:///c:/Users/João%20Pedro/Desktop/SISTEMA%20DEFUMAR/backend/src/modules/online-stores/services/update-online-order-status-service.ts) | Serviço | Nenhum | ✅ OK |
| [get-online-store-summary-service.ts](file:///c:/Users/João%20Pedro/Desktop/SISTEMA%20DEFUMAR/backend/src/modules/online-stores/services/get-online-store-summary-service.ts) | Serviço | Nenhum | ✅ OK - usa apenas `OnlineOrder` |

### 3.2 Prisma Schema
- Arquivo: [schema.prisma](file:///c:/Users/João%20Pedro/Desktop/SISTEMA%20DEFUMAR/backend/prisma/schema.prisma)
- Modelos envolvidos:
  - `OnlineCategory`
  - `OnlineProduct`
  - `OnlineStore`
  - `OnlineOrderItem`
  - `CatalogCategory`
  - `CatalogProduct`

---

## 4. Plano de Migração Passo a Passo

### 4.1 Passo 1: Migrar Dados Existentes (Database)
Criar uma migration para:
1. Para cada `OnlineStore` existente:
   - Identificar sua `Organization`
2. Migrar `OnlineCategory` → `CatalogCategory`:
   - Para cada `OnlineCategory`:
     - Criar `CatalogCategory` na mesma organização
     - Preservar nome, slug
     - **Nota**: Verificar se já existe categoria com mesmo `name` ou `slug` na organização para evitar duplicatas
3. Migrar `OnlineProduct` → `CatalogProduct`:
   - Para cada `OnlineProduct`:
     - Encontrar/migrar sua `OnlineCategory` para `CatalogCategory`
     - Criar `CatalogProduct` na mesma organização
     - Preservar nome, descrição, imagem, preço
     - **Nota**: Verificar duplicatas por `name`
4. Atualizar `OnlineOrderItem`:
   - Para cada `OnlineOrderItem` que tenha `productId` (OnlineProduct):
     - Encontrar o `CatalogProduct` correspondente (migrado)
     - Preencher `catalogProductId` se estiver vazio

### 4.2 Passo 2: Marcar Modelos como Obsoletos no Schema
Adicionar comentários no [schema.prisma](file:///c:/Users/João%20Pedro/Desktop/SISTEMA%20DEFUMAR/backend/prisma/schema.prisma):
```prisma
/// @deprecated Será removido em versões futuras - use CatalogCategory
model OnlineCategory { ... }

/// @deprecated Será removido em versões futuras - use CatalogProduct
model OnlineProduct { ... }
```

### 4.3 Passo 3: Verificações Finais
- ✅ Todas as APIs já usam `CatalogCategory`/`CatalogProduct`!
- ✅ `OnlineOrderItem` já tem `catalogProductId`!
- Não há endpoints para criar/editar `OnlineCategory`/`OnlineProduct` no sistema atual!

### 4.4 Passo 4: Remoção Definitiva (Futuro)
Quando confirmar que não há mais dependências:
1. Remover relações no schema:
   - `OnlineStore.categories`
   - `OnlineStore.products`
   - `OnlineProduct.category`
   - `OnlineProduct.orderItems`
   - `CatalogProduct.onlineOrderItems`
2. Remover modelos:
   - `OnlineCategory`
   - `OnlineProduct`
3. Criar migration para deletar as tabelas do banco de dados

---

## 5. Relatório Final

### 5.1 Arquivos que **não precisam ser alterados**:
- Todos os arquivos do módulo online-stores já estão adaptados para usar o catálogo padrão!

### 5.2 Tarefas Restantes:
1. Criar e executar migration de dados (migrar OnlineCategory/OnlineProduct para CatalogCategory/CatalogProduct)
2. Marcar modelos como obsoletos no schema.prisma
3. (Futuro) Remover modelos e tabelas

---

## 6. Conclusão
A arquitetura já está quase pronta! Todas as APIs já consomem o catálogo padrão, e `OnlineOrderItem` já tem a coluna `catalogProductId`. A única coisa que resta é migrar os dados existentes e marcar os modelos como obsoletos!
