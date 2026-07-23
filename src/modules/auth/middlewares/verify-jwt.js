import jwt from 'jsonwebtoken';
export async function verifyJWT(request, reply) {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return reply.status(401).send({
                message: 'Unauthorized'
            });
        }
        const [, token] = authHeader.split(' ');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        request.user = {
            sub: decoded.sub,
            role: decoded.role,
            organizationId: decoded.organizationId
        };
    }
    catch {
        return reply.status(401).send({
            message: 'Invalid token'
        });
    }
}
