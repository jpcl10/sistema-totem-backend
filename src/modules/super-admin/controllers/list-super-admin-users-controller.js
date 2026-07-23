import { ListSuperAdminUsersService } from '../services/list-super-admin-users-service.js';
export async function listSuperAdminUsersController(request, reply) {
    const service = new ListSuperAdminUsersService();
    const users = await service.execute();
    return reply.send(users);
}
