export const UPLOAD_PIPELINE_VERSION = 1;
export const bytesPerMB = 1024 * 1024;
export const allowedImageMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
];
export const uploadAssetTypes = [
    'generic',
    'logo',
    'logo-light',
    'logo-dark',
    'favicon',
    'banner-desktop',
    'banner-mobile',
    'product',
    'social-image',
    'default-product-image',
    'totem-background',
    'event-banner',
    'event-logo'
];
function mb(value) {
    return value * bytesPerMB;
}
function profile(data) {
    return {
        ...data,
        maxFileSizeInBytes: mb(data.maxFileSizeInMB),
        allowedMimeTypes: allowedImageMimeTypes
    };
}
export const uploadAssetProfiles = {
    generic: profile({
        label: 'imagem',
        maxFileSizeInMB: 5,
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 85
    }),
    logo: profile({
        label: 'logo',
        maxFileSizeInMB: 2,
        width: 512,
        height: 512,
        fit: 'contain',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 90,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
    }),
    'logo-light': profile({
        label: 'logo claro',
        maxFileSizeInMB: 2,
        width: 512,
        height: 512,
        fit: 'contain',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 90,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
    }),
    'logo-dark': profile({
        label: 'logo escuro',
        maxFileSizeInMB: 2,
        width: 512,
        height: 512,
        fit: 'contain',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 90,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
    }),
    favicon: profile({
        label: 'favicon',
        maxFileSizeInMB: 0.5,
        width: 256,
        height: 256,
        fit: 'contain',
        withoutEnlargement: true,
        outputFormat: 'png',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
    }),
    'banner-desktop': profile({
        label: 'banner desktop',
        maxFileSizeInMB: 10,
        width: 1920,
        height: 500,
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 85
    }),
    'banner-mobile': profile({
        label: 'banner mobile',
        maxFileSizeInMB: 8,
        width: 1080,
        height: 600,
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 85
    }),
    product: profile({
        label: 'produto',
        maxFileSizeInMB: 5,
        width: 800,
        height: 800,
        fit: 'cover',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 85
    }),
    'default-product-image': profile({
        label: 'imagem padrao de produto',
        maxFileSizeInMB: 5,
        width: 800,
        height: 800,
        fit: 'cover',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 85
    }),
    'social-image': profile({
        label: 'imagem social',
        maxFileSizeInMB: 8,
        width: 1200,
        height: 630,
        fit: 'cover',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 85
    }),
    'totem-background': profile({
        label: 'fundo do totem',
        maxFileSizeInMB: 10,
        width: 1920,
        height: 1080,
        fit: 'cover',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 85
    }),
    'event-banner': profile({
        label: 'banner do evento',
        maxFileSizeInMB: 10,
        width: 1920,
        height: 500,
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 85
    }),
    'event-logo': profile({
        label: 'logo do evento',
        maxFileSizeInMB: 2,
        width: 512,
        height: 512,
        fit: 'contain',
        withoutEnlargement: true,
        outputFormat: 'webp',
        quality: 90,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
};
const uploadAssetAliases = {
    lightLogo: 'logo-light',
    darkLogo: 'logo-dark',
    bannerDesktop: 'banner-desktop',
    bannerMobile: 'banner-mobile',
    socialImage: 'social-image',
    defaultProductImage: 'default-product-image',
    totemBackground: 'totem-background',
    eventBanner: 'event-banner',
    eventLogo: 'event-logo'
};
export const uploadMaxFileSizeInBytes = Math.max(...Object.values(uploadAssetProfiles)
    .map(profile => profile.maxFileSizeInBytes));
export const uploadMaxFileSizeInMB = uploadMaxFileSizeInBytes / bytesPerMB;
export const uploadMultipartLimits = {
    fileSize: uploadMaxFileSizeInBytes
};
export const sharpLimitInputPixels = 48000000;
export function formatUploadLimitMessage(profileOrMaxMB = uploadMaxFileSizeInMB) {
    if (typeof profileOrMaxMB === 'number') {
        return `Imagem muito grande. Maximo ${profileOrMaxMB} MB.`;
    }
    return `O ${profileOrMaxMB.label} excede o limite de ${profileOrMaxMB.maxFileSizeInMB} MB.`;
}
export function normalizeUploadAssetType(value) {
    if (typeof value !== 'string' ||
        value.trim() === '') {
        return 'generic';
    }
    const normalized = value.trim();
    const alias = uploadAssetAliases[normalized];
    if (alias) {
        return alias;
    }
    if (uploadAssetTypes.includes(normalized)) {
        return normalized;
    }
    throw new Error('INVALID_ASSET_TYPE');
}
export function getUploadOutputContentType(outputFormat) {
    if (outputFormat === 'png') {
        return 'image/png';
    }
    return 'image/webp';
}
export function getUploadOutputExtension(outputFormat) {
    if (outputFormat === 'png') {
        return 'png';
    }
    return 'webp';
}
export function isFileTooLargeError(error) {
    if (typeof error !== 'object' ||
        error === null) {
        return false;
    }
    const maybeError = error;
    return (maybeError.code === 'FST_REQ_FILE_TOO_LARGE' ||
        maybeError.code === 'FILE_TOO_LARGE' ||
        maybeError.statusCode === 413 ||
        maybeError.message === 'request file too large');
}
