import { prisma } from '../../../../lib/prisma.js'

interface UploadCatalogProductImageServiceRequest {
  organizationId: string
  productId: string
  imageUrl: string
}

export class UploadCatalogProductImageService {
  async execute({
    organizationId,
    productId,
    imageUrl
  }: UploadCatalogProductImageServiceRequest) {
    const product = await prisma.catalogProduct.findFirst({
      where: {
        id: productId,
        organizationId
      }
    })

    if (!product) {
      throw new Error('Product not found')
    }

    const updatedProduct = await prisma.catalogProduct.update({
      where: {
        id: productId
      },
      data: {
        imageUrl
      }
    })

    return {
      product: updatedProduct
    }
  }
}