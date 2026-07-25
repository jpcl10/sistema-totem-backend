export function isHiddenCatalogCategoryName(name?: string | null) {
  return typeof name === 'string' && name.trim().toLowerCase() === 'itens do combo'
}

export function shouldIncludeCatalogCategory(category?: { name?: string | null } | null) {
  return !isHiddenCatalogCategoryName(category?.name)
}

export function shouldIncludeCatalogProduct(product?: {
  catalogCategory?: { name?: string | null } | null
} | null) {
  return shouldIncludeCatalogCategory(product?.catalogCategory)
}
