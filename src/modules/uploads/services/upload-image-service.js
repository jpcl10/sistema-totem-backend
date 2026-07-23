import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { AuditAction } from '@prisma/client';
import { logger } from '../../../lib/logger.js';
import { r2 } from '../../../lib/r2.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { getUploadOutputExtension, UPLOAD_PIPELINE_VERSION } from '../upload-config.js';
import { UploadError } from './upload-errors.js';
export class UploadImageService {
    constructor(r2Client = r2, auditLogService = new CreateAuditLogService()) {
        this.r2Client = r2Client;
        this.auditLogService = auditLogService;
    }
    async execute({ organizationId, userId, assetType, profile, buffer, contentType, metadata, originalFilename, publicBaseUrl }) {
        const extension = getUploadOutputExtension(profile.outputFormat);
        const filename = `${metadata.hash}-${randomUUID()}.${extension}`;
        const key = `organizations/${organizationId}/assets/${assetType}/v${UPLOAD_PIPELINE_VERSION}/${filename}`;
        try {
            await this.r2Client.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: contentType,
                CacheControl: 'public, max-age=31536000, immutable'
            }));
        }
        catch (error) {
            logger.error({
                err: error,
                stage: 'R2_PUT_OBJECT',
                bucketConfigured: Boolean(process.env.R2_BUCKET_NAME),
                accountIdConfigured: Boolean(process.env.R2_ACCOUNT_ID),
                accessKeyConfigured: Boolean(process.env.R2_ACCESS_KEY_ID),
                secretKeyConfigured: Boolean(process.env.R2_SECRET_ACCESS_KEY),
                key,
                contentType,
                sizeInBytes: buffer.length,
                assetType,
                pipelineVersion: UPLOAD_PIPELINE_VERSION
            }, 'Upload failed while sending image to Cloudflare R2');
            throw new UploadError('UPLOAD_FAILED', 'Erro interno ao enviar imagem.', 500);
        }
        const imageUrl = `${publicBaseUrl}/${key}`;
        await this.auditLogService.execute({
            organizationId,
            userId,
            entity: 'Image',
            entityId: key,
            action: AuditAction.IMAGE_UPLOADED,
            description: 'Imagem enviada para o Cloudflare R2',
            metadata: {
                key,
                imageUrl,
                originalFilename,
                pipelineVersion: UPLOAD_PIPELINE_VERSION,
                assetType,
                processedHash: metadata.hash,
                originalSizeInBytes: metadata.original.sizeInBytes,
                processedSizeInBytes: metadata.sizeInBytes,
                width: metadata.width,
                height: metadata.height,
                contentType
            }
        });
        return {
            imageUrl,
            key,
            metadata
        };
    }
}
