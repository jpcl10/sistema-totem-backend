import { logger } from '../../../lib/logger.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
import { formatUploadLimitMessage, isFileTooLargeError, normalizeUploadAssetType, uploadAssetProfiles, uploadMaxFileSizeInBytes, uploadMaxFileSizeInMB } from '../upload-config.js';
import { ProcessImageService } from '../services/process-image-service.js';
import { UploadImageService } from '../services/upload-image-service.js';
import { UploadError } from '../services/upload-errors.js';
function getMultipartFieldValue(fields, fieldName) {
    const field = fields[fieldName];
    const firstField = Array.isArray(field)
        ? field[0]
        : field;
    if (typeof firstField === 'object' &&
        firstField !== null &&
        'value' in firstField) {
        return firstField.value;
    }
    return undefined;
}
function sendUploadError(reply, error) {
    const payload = {
        code: error.code,
        message: error.message
    };
    if (error.limit) {
        payload.limit = error.limit;
    }
    return reply.status(error.statusCode).send(payload);
}
function sendGlobalFileTooLargeResponse(reply) {
    return reply.status(413).send({
        code: 'FILE_TOO_LARGE',
        message: formatUploadLimitMessage(),
        limit: {
            bytes: uploadMaxFileSizeInBytes,
            megabytes: uploadMaxFileSizeInMB
        }
    });
}
export async function uploadImageController(request, reply) {
    const publicBaseUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, '');
    if (!publicBaseUrl) {
        logger.error(new Error('R2_PUBLIC_URL nao configurada'));
        return reply.status(500).send({
            code: 'UPLOAD_FAILED',
            message: 'Configuracao de upload indisponivel.'
        });
    }
    const organizationId = getTenantOrganizationId(request);
    let file;
    try {
        file = await request.file();
    }
    catch (error) {
        if (isFileTooLargeError(error)) {
            return sendGlobalFileTooLargeResponse(reply);
        }
        throw error;
    }
    if (!file) {
        return reply.status(400).send({
            code: 'INVALID_IMAGE',
            message: 'Imagem nao enviada.'
        });
    }
    let assetType;
    try {
        assetType = normalizeUploadAssetType(getMultipartFieldValue(file.fields, 'assetType'));
    }
    catch {
        return reply.status(400).send({
            code: 'INVALID_ASSET_TYPE',
            message: 'assetType invalido.'
        });
    }
    const assetProfile = uploadAssetProfiles[assetType];
    let originalBuffer;
    try {
        originalBuffer = await file.toBuffer();
    }
    catch (error) {
        if (isFileTooLargeError(error)) {
            return sendGlobalFileTooLargeResponse(reply);
        }
        throw error;
    }
    try {
        const processed = await new ProcessImageService().execute({
            buffer: originalBuffer,
            originalContentType: file.mimetype,
            assetType,
            profile: assetProfile
        });
        const uploaded = await new UploadImageService().execute({
            organizationId,
            userId: request.user.sub,
            assetType,
            profile: assetProfile,
            buffer: processed.buffer,
            contentType: processed.contentType,
            metadata: processed.metadata,
            originalFilename: file.filename,
            publicBaseUrl
        });
        logger.info({
            organizationId,
            key: uploaded.key,
            imageUrl: uploaded.imageUrl,
            assetType
        }, 'Imagem processada e enviada para o R2');
        return reply.status(201).send({
            imageUrl: uploaded.imageUrl,
            key: uploaded.key,
            metadata: uploaded.metadata
        });
    }
    catch (error) {
        if (error instanceof UploadError) {
            return sendUploadError(reply, error);
        }
        logger.error(error, 'Erro inesperado no upload de imagem');
        return reply.status(500).send({
            code: 'UPLOAD_FAILED',
            message: 'Erro interno ao enviar imagem.'
        });
    }
}
