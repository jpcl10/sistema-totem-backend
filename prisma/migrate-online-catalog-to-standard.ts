import { PrismaClient, CatalogCategory, CatalogProduct } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  categoriesMigrated: number;
  categoriesReused: number;
  productsMigrated: number;
  productsReused: number;
  orderItemsUpdated: number;
}

// Função para gerar slug a partir de nome
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('🔄 Iniciando migração de catálogo online para catálogo padrão...');
  console.log('='.repeat(80));

  const stats: MigrationStats = {
    categoriesMigrated: 0,
    categoriesReused: 0,
    productsMigrated: 0,
    productsReused: 0,
    orderItemsUpdated: 0,
  };

  // Mapa para armazenar correspondências: OnlineCategory.id → CatalogCategory
  const categoryMap = new Map<string, CatalogCategory>();
  // Mapa para armazenar correspondências: OnlineProduct.id → CatalogProduct
  const productMap = new Map<string, CatalogProduct>();

  try {
    // Passo 1: Buscar todas as OnlineStores com suas categorias e produtos
    const onlineStores = await prisma.onlineStore.findMany({
      include: {
        categories: true,
        products: true,
      },
    });

    console.log(`✅ Encontradas ${onlineStores.length} lojas online`);

    for (const store of onlineStores) {
      console.log(`\n📦 Processando loja: ${store.name} (ID: ${store.id})`);
      console.log(`  Organização: ${store.organizationId}`);
      console.log(`  Categorias online: ${store.categories.length}`);
      console.log(`  Produtos online: ${store.products.length}`);

      // Passo 2: Migrar OnlineCategory para CatalogCategory
      for (const onlineCategory of store.categories) {
        // Verificar se já existe CatalogCategory com mesmo name ou slug na mesma organização
        let catalogCategory = await prisma.catalogCategory.findFirst({
          where: {
            organizationId: store.organizationId,
            OR: [{ name: onlineCategory.name }, { slug: onlineCategory.slug }],
          },
        });

        if (catalogCategory) {
          console.log(`    ⚙️  Reaproveitando categoria: ${onlineCategory.name} (ID: ${catalogCategory.id})`);
          stats.categoriesReused++;
        } else {
          // Criar nova CatalogCategory
          catalogCategory = await prisma.catalogCategory.create({
            data: {
              organizationId: store.organizationId,
              name: onlineCategory.name,
              slug: onlineCategory.slug,
              sector: 'KITCHEN', // Valor padrão, já que OnlineCategory não tem sector
              active: onlineCategory.active,
            },
          });
          console.log(`    ✨ Criada categoria: ${onlineCategory.name} (ID: ${catalogCategory.id})`);
          stats.categoriesMigrated++;
        }

        categoryMap.set(onlineCategory.id, catalogCategory);
      }

      // Passo 3: Migrar OnlineProduct para CatalogProduct
      for (const onlineProduct of store.products) {
        // Encontrar a CatalogCategory correspondente
        const catalogCategory = categoryMap.get(onlineProduct.categoryId);
        if (!catalogCategory) {
          console.warn(`    ⚠️  Categoria não encontrada para produto ${onlineProduct.name}, pulando...`);
          continue;
        }

        // Gerar slug para o produto
        const productSlug = generateSlug(onlineProduct.name);

        // Verificar se já existe CatalogProduct com mesmo name ou slug na mesma organização
        let catalogProduct = await prisma.catalogProduct.findFirst({
          where: {
            organizationId: store.organizationId,
            OR: [{ name: onlineProduct.name }, { slug: productSlug }],
          },
        });

        if (catalogProduct) {
          console.log(`    ⚙️  Reaproveitando produto: ${onlineProduct.name} (ID: ${catalogProduct.id})`);
          stats.productsReused++;
        } else {
          // Criar novo CatalogProduct
          catalogProduct = await prisma.catalogProduct.create({
            data: {
              organizationId: store.organizationId,
              catalogCategoryId: catalogCategory.id,
              name: onlineProduct.name,
              slug: productSlug,
              description: onlineProduct.description,
              imageUrl: onlineProduct.imageUrl,
              priceInCents: onlineProduct.priceInCents,
              active: onlineProduct.active,
            },
          });
          console.log(`    ✨ Criado produto: ${onlineProduct.name} (ID: ${catalogProduct.id})`);
          stats.productsMigrated++;
        }

        productMap.set(onlineProduct.id, catalogProduct);
      }
    }

    // Passo 4: Atualizar OnlineOrderItem com catalogProductId
    console.log('\n🔗 Atualizando itens de pedidos online...');
    const orderItemsToUpdate = await prisma.onlineOrderItem.findMany({
      where: {
        productId: { not: null },
        catalogProductId: null,
      },
    });

    console.log(`✅ Encontrados ${orderItemsToUpdate.length} itens de pedido para atualizar`);

    for (const orderItem of orderItemsToUpdate) {
      const catalogProduct = productMap.get(orderItem.productId!);
      if (catalogProduct) {
        await prisma.onlineOrderItem.update({
          where: { id: orderItem.id },
          data: { catalogProductId: catalogProduct.id },
        });
        stats.orderItemsUpdated++;
        console.log(`    ✅ Atualizado item ${orderItem.id} → catalogProductId: ${catalogProduct.id}`);
      }
    }

    // Verificar Guello's Pizza
    console.log('\n🍕 Verificando Guello\'s Pizza...');
    const guellosOrganization = await prisma.organization.findFirst({
      where: { name: { contains: 'Guello' } },
      include: {
        catalogProducts: true,
      },
    });

    if (guellosOrganization) {
      console.log(`✅ Guello's Pizza tem ${guellosOrganization.catalogProducts.length} produtos no catálogo padrão!`);
    }

    // Exibir estatísticas finais
    console.log('\n' + '='.repeat(80));
    console.log('✅ Migração concluída com sucesso!');
    console.log('📊 Estatísticas:');
    console.log(`  - Categorias migradas: ${stats.categoriesMigrated}`);
    console.log(`  - Categorias reaproveitadas: ${stats.categoriesReused}`);
    console.log(`  - Produtos migrados: ${stats.productsMigrated}`);
    console.log(`  - Produtos reaproveitados: ${stats.productsReused}`);
    console.log(`  - Itens de pedido atualizados: ${stats.orderItemsUpdated}`);
    console.log('='.repeat(80));
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
