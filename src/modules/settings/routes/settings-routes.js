import { verifyJWT } from '../../auth/middlewares/verify-jwt.js';
import { requireTenantContext } from '../../auth/middlewares/request-context.js';
import { createBusinessHourExceptionController, createDeliveryFeeRuleController, deleteBusinessHourExceptionController, deleteDeliveryFeeRuleController, getBrandingSettingsController, getBusinessHoursController, getDeliverySettingsController, getEffectiveSettingsController, getPrintingSettingsController, getOnlineOrderSettingsController, getSettingsController, listDeliveryFeeRulesController, updateBrandingSettingsController, updateBusinessHourExceptionController, updateDeliveryFeeRuleController, updateDeliverySettingsController, updatePrintingSettingsController, updateGeneralSettingsController, updateOnlineOrderSettingsController, upsertBusinessHoursController } from '../controllers/settings-controllers.js';
export async function settingsRoutes(app) {
    const tenantPreHandler = [
        verifyJWT,
        requireTenantContext
    ];
    const rateLimit = {
        max: 300,
        timeWindow: '1 minute'
    };
    app.get('/settings', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, getSettingsController);
    app.patch('/settings/general', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, updateGeneralSettingsController);
    app.get('/settings/branding', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, getBrandingSettingsController);
    app.patch('/settings/branding', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, updateBrandingSettingsController);
    app.get('/settings/printing', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, getPrintingSettingsController);
    app.patch('/settings/printing', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, updatePrintingSettingsController);
    app.get('/settings/business-hours', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, getBusinessHoursController);
    app.put('/settings/business-hours', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, upsertBusinessHoursController);
    app.post('/settings/business-hours/exceptions', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, createBusinessHourExceptionController);
    app.patch('/settings/business-hours/exceptions/:exceptionId', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, updateBusinessHourExceptionController);
    app.delete('/settings/business-hours/exceptions/:exceptionId', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, deleteBusinessHourExceptionController);
    app.get('/settings/online-orders', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, getOnlineOrderSettingsController);
    app.patch('/settings/online-orders', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, updateOnlineOrderSettingsController);
    app.get('/settings/delivery', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, getDeliverySettingsController);
    app.patch('/settings/delivery', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, updateDeliverySettingsController);
    app.get('/settings/delivery/rules', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, listDeliveryFeeRulesController);
    app.post('/settings/delivery/rules', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, createDeliveryFeeRuleController);
    app.patch('/settings/delivery/rules/:ruleId', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, updateDeliveryFeeRuleController);
    app.delete('/settings/delivery/rules/:ruleId', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, deleteDeliveryFeeRuleController);
    app.get('/settings/effective', {
        preHandler: tenantPreHandler,
        config: { rateLimit }
    }, getEffectiveSettingsController);
}
