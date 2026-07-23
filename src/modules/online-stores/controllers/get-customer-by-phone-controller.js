import { GetCustomerByPhoneService } from '../services/get-customer-by-phone-service.js';
export async function getCustomerByPhoneController(request, reply) {
    try {
        const { slug } = request.params;
        const { phone } = request.query;
        const getCustomerByPhoneService = new GetCustomerByPhoneService();
        const result = await getCustomerByPhoneService.execute({
            slug,
            phone
        });
        return reply.status(200).send(result);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Store not found') {
            return reply.status(404).send({ message: 'Loja não encontrada' });
        }
        throw error;
    }
}
