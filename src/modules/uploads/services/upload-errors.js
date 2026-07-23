export class UploadError extends Error {
    constructor(code, message, statusCode = 400, limit) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.limit = limit;
    }
}
export function createFileTooLargeError(profile) {
    return new UploadError('FILE_TOO_LARGE', `O ${profile.label} excede o limite de ${profile.maxFileSizeInMB} MB.`, 413, {
        bytes: profile.maxFileSizeInBytes,
        megabytes: profile.maxFileSizeInMB
    });
}
