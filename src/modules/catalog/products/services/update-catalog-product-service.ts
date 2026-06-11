import { prisma } from '../../../../lib/prisma.js'

interface UpdateCatalogProductServiceRequest {
  organizationId: string

  productId: string

  categoryId?: string

  name?: string
  slug?: string
  description?: string
  imageUrl?: string | null

  active?: boolean
}

export class UpdateCatalogProductService {
  async execute({
    organizationId,
    productId,
    categoryId,
    name,
    slug,
    description,
    imageUrl,
    active
  }: UpdateCatalogProductServiceRequest) {

    const product =
      await prisma.catalogProduct.findFirst({
        where: {
          id: productId,
          organizationId
        }
      })

    if (!product) {
      throw new Error('Product not found')
    }

    if (categoryId) {
      const category =
        await prisma.catalogCategory.findFirst({
          where: {
            id: categoryId,
            organizationId
          }
        })

      if (!category) {
        throw new Error('Category not found')
      }
    }

    const updatedProduct =
      await prisma.catalogProduct.update({
        where: {
          id: productId
        },
        data: {
          ...(categoryId !== undefined && {
            catalogCategoryId: categoryId
          }),

          ...(name !== undefined && {
            name
          }),

          ...(slug !== undefined && {
            slug
          }),

          ...(description !== undefined && {
            description
          }),

          ...(imageUrl !== undefined && {
            imageUrl
          }),

          ...(active !== undefined && {
            active
          })
        }
      })

    return {
      product: updatedProduct
    }
  }
}