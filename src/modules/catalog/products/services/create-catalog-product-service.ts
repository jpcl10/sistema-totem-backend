import { prisma } from '../../../../lib/prisma.js'

interface CreateCatalogProductServiceRequest {
  organizationId: string

  categoryId: string

  name: string
  slug: string

  description?: string
  imageUrl?: string
}

export class CreateCatalogProductService {
  async execute({
    organizationId,
    categoryId,
    name,
    slug,
    description,
    imageUrl
  }: CreateCatalogProductServiceRequest) {

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

    const productWithSameSlug =
      await prisma.catalogProduct.findFirst({
        where: {
          organizationId,
          slug
        }
      })

    if (productWithSameSlug) {
      throw new Error('Product already exists')
    }

    const product =
      await prisma.catalogProduct.create({
        data: {
                organizationId,
                catalogCategoryId: categoryId,
                name,
                slug,
                description,
                imageUrl
            }
      })

    return {
      product
    }
  }
}