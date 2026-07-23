const lovableHostname = 'lovable.app';
const lovableHostnameSuffix = '.lovable.app';
const isProduction = process.env.NODE_ENV === 'production';
export const corsAllowedHeaders = [
    'Authorization',
    'Content-Type',
    'x-organization-id',
    'ngrok-skip-browser-warning'
];
export const corsAllowedMethods = [
    'GET',
    'POST',
    'PATCH',
    'DELETE',
    'OPTIONS'
];
function shouldAllowLovableOrigins() {
    return process.env.ALLOW_LOVABLE_ORIGINS === 'true' || !isProduction;
}
function defaultDevelopmentOrigins() {
    if (isProduction) {
        return [];
    }
    return [
        'http://localhost:5173',
        'http://localhost:3000'
    ];
}
function readOriginConfig(primaryValue) {
    return (primaryValue ??
        process.env.CORS_ALLOWED_ORIGINS ??
        process.env.ALLOWED_ORIGINS ??
        process.env.FRONTEND_URL);
}
function parseAllowedOrigins(value) {
    const origins = new Set();
    for (const origin of defaultDevelopmentOrigins()) {
        origins.add(origin);
    }
    if (!value) {
        return Array.from(origins);
    }
    value
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
        .map(normalizeOrigin)
        .filter((origin) => Boolean(origin))
        .forEach(origin => origins.add(origin));
    return Array.from(origins);
}
function normalizeOrigin(origin) {
    try {
        return new URL(origin).origin;
    }
    catch {
        return null;
    }
}
function isLovableOrigin(origin) {
    try {
        const parsedOrigin = new URL(origin);
        return (parsedOrigin.protocol === 'https:' &&
            (parsedOrigin.hostname === lovableHostname ||
                parsedOrigin.hostname.endsWith(lovableHostnameSuffix)));
    }
    catch {
        return false;
    }
}
export const allowedOrigins = Array.from(new Set(parseAllowedOrigins(readOriginConfig())));
const allowedOriginsSet = new Set(allowedOrigins);
export const socketAllowedOrigins = Array.from(new Set(parseAllowedOrigins(readOriginConfig(process.env.SOCKET_ALLOWED_ORIGINS))));
const socketAllowedOriginsSet = new Set(socketAllowedOrigins);
export function isOriginAllowed(origin) {
    if (!origin) {
        return true;
    }
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) {
        return false;
    }
    return (allowedOriginsSet.has(normalizedOrigin) ||
        (shouldAllowLovableOrigins() &&
            isLovableOrigin(normalizedOrigin)));
}
export function isSocketOriginAllowed(origin) {
    if (!origin) {
        return true;
    }
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) {
        return false;
    }
    return (socketAllowedOriginsSet.has(normalizedOrigin) ||
        (shouldAllowLovableOrigins() &&
            isLovableOrigin(normalizedOrigin)));
}
export function validateCorsOrigin(origin, callback) {
    if (isOriginAllowed(origin)) {
        return callback(null, true);
    }
    return callback(null, false);
}
export function validateSocketCorsOrigin(origin, callback) {
    if (isSocketOriginAllowed(origin)) {
        return callback(null, true);
    }
    return callback(null, false);
}
