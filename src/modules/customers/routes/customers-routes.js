import { verifyJWT } from '../../auth/middlewares/verify-jwt.js';
import { requireTenantContext } from '../../auth/middlewares/request-context.js';
import { addCustomerInterestController, createCustomerAddressController, createCustomerController, createInterestController, getCustomerController, listCustomerAddressesController, listCustomersController, listInterestsController, removeCustomerInterestController, updateCustomerAddressController, updateCustomerAddressStatusController, updateCustomerController, updateCustomerStatusController, updateInterestController, updateInterestStatusController } from '../controllers/customers-controllers.js';
export async function customersRoutes(app) {
    const tenantPreHandler = [verifyJWT, requireTenantContext];
    app.get('/customers', { preHandler: tenantPreHandler }, listCustomersController);
    app.post('/customers', { preHandler: tenantPreHandler }, createCustomerController);
    app.get('/customers/:customerId', { preHandler: tenantPreHandler }, getCustomerController);
    app.patch('/customers/:customerId', { preHandler: tenantPreHandler }, updateCustomerController);
    app.patch('/customers/:customerId/status', { preHandler: tenantPreHandler }, updateCustomerStatusController);
    app.get('/customers/:customerId/addresses', { preHandler: tenantPreHandler }, listCustomerAddressesController);
    app.post('/customers/:customerId/addresses', { preHandler: tenantPreHandler }, createCustomerAddressController);
    app.patch('/customers/:customerId/addresses/:addressId', { preHandler: tenantPreHandler }, updateCustomerAddressController);
    app.patch('/customers/:customerId/addresses/:addressId/status', { preHandler: tenantPreHandler }, updateCustomerAddressStatusController);
    app.get('/interests', { preHandler: tenantPreHandler }, listInterestsController);
    app.post('/interests', { preHandler: tenantPreHandler }, createInterestController);
    app.patch('/interests/:interestId', { preHandler: tenantPreHandler }, updateInterestController);
    app.patch('/interests/:interestId/status', { preHandler: tenantPreHandler }, updateInterestStatusController);
    app.post('/customers/:customerId/interests', { preHandler: tenantPreHandler }, addCustomerInterestController);
    app.delete('/customers/:customerId/interests/:interestId', { preHandler: tenantPreHandler }, removeCustomerInterestController);
}
