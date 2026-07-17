import { prisma } from '../../../../lib/prisma.js'
import { AuditAction, UserRole } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'
import type { ImportCatalogRequest } from '../schemas/import-catalog-schema.js'

interface ImportCatalogServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string
  data: ImportCatalogRequest
}

interface ImportCatalogResult {
  success: boolean
  dryRun: boolean
  summary: {
    categoriesCreated: number
    categoriesUpdated: number
    productsCreated: number
    productsUpdated: number
    groupsCreated: number
    groupsUpdated: number
    optionsCreated: number
    optionsUpdated: number
  }
  categories: Array<{
    id: string
    name: string
    slug: string
    action: 'created' | 'updated'
  }>
  products: Array<{
    id: string
    name: string
    slug: string
    action: 'created' | 'updated'
  }>
}

export class ImportCatalogService {
  async execute({
    organizationId,
    userId,
    data
  }: ImportCatalogServiceRequest): Promise<ImportCatalogResult> {
    const { dryRun, categories, products } = data

    // Validate: no duplicate slugs in categories or products
    const categorySlugs = categories.map(c => c.slug)
    if (new Set(categorySlugs).size !== categorySlugs.length) {
      throw new Error('Duplicate category slugs in payload')
    }

    const productSlugs = products.map(p => p.slug)
    if (new Set(productSlugs).size !== productSlugs.length) {
      throw new Error('Duplicate product slugs in payload')
    }

    // Validate: all product categorySlugs exist in categories payload
    const productCategorySlugs = products.map(p => p.categorySlug)
    const missingCategories = productCategorySlugs.filter(
      slug => !categories.find(c => c.slug === slug)
    )
    if (missingCategories.length > 0) {
      throw new Error(`Categories not found in payload: ${missingCategories.join(', ')}`)
    }

    // Validate: product option group keys are unique per product
    for (const product of products) {
      const groupKeys = product.optionGroups.map(g => g.key)
      if (new Set(groupKeys).size !== groupKeys.length) {
        throw new Error(`Duplicate option group keys in product ${product.slug}`)
      }

      // Validate: option keys are unique per group
      for (const group of product.optionGroups) {
        const optionKeys = group.options.map(o => o.key)
        if (new Set(optionKeys).size !== optionKeys.length) {
          throw new Error(`Duplicate option keys in group ${group.key} of product ${product.slug}`)
        }

        // Validate: maxSelections >= minSelections
        if (group.maxSelections < group.minSelections) {
          throw new Error(`maxSelections must be >= minSelections in group ${group.key} of product ${product.slug}`)
        }

        // Validate: if required, minSelections >= 1
        if (group.required && group.minSelections < 1) {
          throw new Error(`minSelections must be at least 1 when required is true in group ${group.key} of product ${product.slug}`)
        }
      }
    }

    // If dryRun, just return a summary without making changes
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        summary: {
          categoriesCreated: categories.length,
          categoriesUpdated: 0,
          productsCreated: products.length,
          productsUpdated: 0,
          groupsCreated: products.reduce((acc, p) => acc + p.optionGroups.length, 0),
          groupsUpdated: 0,
          optionsCreated: products.reduce((acc, p) => acc + p.optionGroups.reduce((acc2, g) => acc2 + g.options.length, 0), 0),
          optionsUpdated: 0
        },
        categories: categories.map(c => ({ id: 'dry-run', name: c.name, slug: c.slug, action: 'created' })),
        products: products.map(p => ({ id: 'dry-run', name: p.name, slug: p.slug, action: 'created' }))
      }
    }

    // Execute import in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const categoryResults: Array<{
        id: string
        name: string
        slug: string
        action: 'created' | 'updated'
      }> = []

      const productResults: Array<{
        id: string
        name: string
        slug: string
        action: 'created' | 'updated'
      }> = []

      let categoriesCreated = 0
      let categoriesUpdated = 0
      let productsCreated = 0
      let productsUpdated = 0
      let groupsCreated = 0
      let groupsUpdated = 0
      let optionsCreated = 0
      let optionsUpdated = 0

      // Process categories
      const categoryMap = new Map<string, string>() // slug -> id
      for (const categoryData of categories) {
        const existingCategory = await tx.catalogCategory.findUnique({
          where: {
              organizationId_slug: {
              organizationId,
              slug: categoryData.slug
            }
          }
        })

        if (existingCategory) {
          // Update existing category
          const updatedCategory = await tx.catalogCategory.update({
            where: { id: existingCategory.id },
            data: {
              name: categoryData.name,
              sector: categoryData.sector,
              active: categoryData.active,
              sortOrder: categoryData.sortOrder
            }
          })
          categoryMap.set(categoryData.slug, updatedCategory.id)
          categoryResults.push({
            id: updatedCategory.id,
            name: updatedCategory.name,
            slug: updatedCategory.slug,
            action: 'updated'
          })
          categoriesUpdated++
        } else {
          // Create new category
          const newCategory = await tx.catalogCategory.create({
            data: {
              organizationId,
              name: categoryData.name,
              slug: categoryData.slug,
              sector: categoryData.sector,
              active: categoryData.active,
              sortOrder: categoryData.sortOrder
            }
          })
          categoryMap.set(categoryData.slug, newCategory.id)
          categoryResults.push({
            id: newCategory.id,
            name: newCategory.name,
            slug: newCategory.slug,
            action: 'created'
          })
          categoriesCreated++
        }
      }

      // Process products
      const productMap = new Map<string, string>() // slug -> id
      for (const productData of products) {
        const categoryId = categoryMap.get(productData.categorySlug)
        if (!categoryId) {
          throw new Error(`Category not found: ${productData.categorySlug}`)
        }

        const existingProduct = await tx.catalogProduct.findUnique({
          where: {
              organizationId_slug: {
              organizationId,
              slug: productData.slug
            }
          }
        })

        let productId: string
        if (existingProduct) {
          // Update existing product
          const updatedProduct = await tx.catalogProduct.update({
            where: { id: existingProduct.id },
            data: {
              catalogCategoryId: categoryId,
              name: productData.name,
              description: productData.description,
              imageUrl: productData.imageUrl,
              priceInCents: productData.priceInCents,
              active: productData.active,
              sortOrder: productData.sortOrder
            }
          })
          productId = updatedProduct.id
          productResults.push({
            id: updatedProduct.id,
            name: updatedProduct.name,
            slug: updatedProduct.slug,
            action: 'updated'
          })
          productsUpdated++
        } else {
          // Create new product
          const newProduct = await tx.catalogProduct.create({
            data: {
              organizationId,
              catalogCategoryId: categoryId,
              name: productData.name,
              slug: productData.slug,
              description: productData.description,
              imageUrl: productData.imageUrl,
              priceInCents: productData.priceInCents,
              active: productData.active,
              sortOrder: productData.sortOrder
            }
          })
          productId = newProduct.id
          productResults.push({
            id: newProduct.id,
            name: newProduct.name,
            slug: newProduct.slug,
            action: 'created'
          })
          productsCreated++
        }
        productMap.set(productData.slug, productId)
      }

      // Now process option groups and options for each product
      for (const productData of products) {
        const productId = productMap.get(productData.slug)
        if (!productId) {
          throw new Error(`Product not found: ${productData.slug}`)
        }

        for (const groupData of productData.optionGroups) {
          const existingGroup = await tx.catalogProductOptionGroup.findUnique({
            where: {
              productId_key: {
                productId,
                key: groupData.key
              }
            }
          })

          let groupId: string
          if (existingGroup) {
            // Update existing group
            const updatedGroup = await tx.catalogProductOptionGroup.update({
              where: { id: existingGroup.id },
              data: {
                name: groupData.name,
                description: groupData.description,
                required: groupData.required,
                minSelections: groupData.minSelections,
                maxSelections: groupData.maxSelections,
                sortOrder: groupData.sortOrder,
                active: groupData.active
              }
            })
            groupId = updatedGroup.id
            groupsUpdated++
          } else {
            // Create new group
            const newGroup = await tx.catalogProductOptionGroup.create({
              data: {
                organizationId,
                productId,
                name: groupData.name,
                key: groupData.key,
                description: groupData.description,
                required: groupData.required,
                minSelections: groupData.minSelections,
                maxSelections: groupData.maxSelections,
                sortOrder: groupData.sortOrder,
                active: groupData.active
              }
            })
            groupId = newGroup.id
            groupsCreated++
          }

          // Process options for this group
          for (const optionData of groupData.options) {
            let linkedProductId: string | null = null
            if (optionData.linkedProductSlug) {
              linkedProductId = productMap.get(optionData.linkedProductSlug) || null
              if (!linkedProductId) {
                // Check if linked product exists in database
                const existingLinkedProduct = await tx.catalogProduct.findUnique({
                  where: {
                    organizationId_slug: {
                      organizationId,
                      slug: optionData.linkedProductSlug
                    }
                  }
                })
                if (!existingLinkedProduct) {
                  throw new Error(`Linked product not found: ${optionData.linkedProductSlug}`)
                }
                linkedProductId = existingLinkedProduct.id
              }
            }

            const existingOption = await tx.catalogProductOption.findUnique({
              where: {
                optionGroupId_key: {
                  optionGroupId: groupId,
                  key: optionData.key
                }
              }
            })

            if (existingOption) {
              // Update existing option
              await tx.catalogProductOption.update({
                where: { id: existingOption.id },
                data: {
                  name: optionData.name,
                  description: optionData.description,
                  priceDeltaInCents: optionData.priceDeltaInCents,
                  linkedProductId,
                  sortOrder: optionData.sortOrder,
                  active: optionData.active
                }
              })
              optionsUpdated++
            } else {
              // Create new option
              await tx.catalogProductOption.create({
                data: {
                  organizationId,
                  optionGroupId: groupId,
                  name: optionData.name,
                  key: optionData.key,
                  description: optionData.description,
                  priceDeltaInCents: optionData.priceDeltaInCents,
                  linkedProductId,
                  sortOrder: optionData.sortOrder,
                  active: optionData.active
                }
              })
              optionsCreated++
            }
          }
        }
      }

      return {
        categoryResults,
        productResults,
        summary: {
          categoriesCreated,
          categoriesUpdated,
          productsCreated,
          productsUpdated,
          groupsCreated,
          groupsUpdated,
          optionsCreated,
          optionsUpdated
        }
      }
    })

    // Create audit log
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      userId,
      entity: 'CatalogImport',
      entityId: null,
      action: AuditAction.PRODUCT_CREATED, // We'll add new actions later, for now use PRODUCT_CREATED
      description: 'Catálogo importado',
      metadata: {
        ...result.summary,
        dryRun
      }
    })

    return {
      success: true,
      dryRun,
      summary: result.summary,
      categories: result.categoryResults,
      products: result.productResults
    }
  }
}
