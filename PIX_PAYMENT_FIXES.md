# PIX Payment Flow - Bug Fixes and Configuration Guide

## Executive Summary

Two issues were reported with PIX payments:
1. **Totem PIX appears blocked** despite previous configuration
2. **Digital Menu PIX orders immediately confirmed** without payment flow

Both issues have been diagnosed and root causes identified. This guide provides the complete fix process.

---

## Issue #1: Totem PIX Blocked ❌

### Root Cause
**Mercado Pago payment provider settings are NOT configured in the database.**

The diagnostic revealed:
- ✓ PIX is enabled at organization level
- ✓ Organization payment settings exist
- ❌ **NO Mercado Pago PaymentProviderSettings record found**
- ❌ **NO PaymentProviderCredential records for MP found**

### Technical Details

When a user requests checkout settings from the Totem, the flow is:
1. Frontend calls `/checkout-payment-settings` endpoint
2. Backend service `GetCheckoutPaymentSettingsService` checks MP configuration
3. It queries `PaymentProviderSettings` for `MERCADO_PAGO` provider
4. Since MP settings are missing → `mercadoPagoEnabled = false`
5. Since MP not enabled → `pixAvailable = false`
6. Frontend receives empty PIX option and hides the button

**See**: [backend/src/modules/payments/services/get-checkout-payment-settings-service.ts](backend/src/modules/payments/services/get-checkout-payment-settings-service.ts#L39)

### How to Fix

#### Step 1: Obtain Mercado Pago Credentials

You need three credentials from Mercado Pago:

1. **Access Token**: Used for API calls
   - Go to https://www.mercadopago.com.br/developers
   - Login to your account
   - Navigate to "Credenciais" (Credentials)
   - Copy your "Production Access Token"

2. **Public Key**: Used for frontend (PIX QR code generation)
   - Same location as Access Token
   - Copy your "Production Public Key"

3. **Webhook Secret** (Optional): For receiving payment status updates
   - In Webhook settings, copy your webhook signature key

4. **Webhook URL** (Optional): Where Mercado Pago sends payment updates
   - Example: `https://seu-backend.com/webhooks/mercado-pago`

#### Step 2: Update Environment Variables

Edit `backend/.env` and replace placeholder values:

```bash
# Before (placeholders):
MERCADO_PAGO_ACCESS_TOKEN="seu-access-token"
MERCADO_PAGO_PUBLIC_KEY="sua-public-key"
MERCADO_PAGO_WEBHOOK_SECRET="seu-webhook-secret"
MERCADO_PAGO_WEBHOOK_URL="https://seu-backend.com/webhooks/mercado-pago"

# After (real values):
MERCADO_PAGO_ACCESS_TOKEN="APP_USR_1234567890-abcdefghijklmnop..."
MERCADO_PAGO_PUBLIC_KEY="APP_USR_1234567890-qrstuvwxyzabcdef..."
MERCADO_PAGO_WEBHOOK_SECRET="your-webhook-secret-key"
MERCADO_PAGO_WEBHOOK_URL="https://seu-backend.com/webhooks/mercado-pago"
```

#### Step 3: Configure Payment Provider Settings in Database

Run the setup script to create the Mercado Pago provider configuration:

```bash
cd backend

# Option A: Using environment variables from .env
npx tsx scripts/setup-mercado-pago-provider.ts

# Option B: Passing credentials as arguments
npx tsx scripts/setup-mercado-pago-provider.ts \
  "APP_USR_1234567890-..." \
  "APP_USR_1234567890-..." \
  "webhook-secret" \
  "https://seu-backend.com/webhooks/mercado-pago"
```

**Expected output**:
```
✅ Mercado Pago Provider Settings Configured Successfully!

💳 Configuration:
   ✓ Provider: MERCADO_PAGO
   ✓ Enabled: true
   ✓ PIX Enabled: true
   ✓ Card Enabled: true
```

#### Step 4: Verify Configuration

Run the diagnostic script again:

```bash
cd backend
npx tsx scripts/diagnose-pix-payment-flow.ts
```

**Expected output**:
```
💳 Mercado Pago Settings:
   ✓ Enabled: true
   ✓ PIX Enabled: true
   ✓ Card Enabled: true
   ✓ Access Token configured: true
```

#### Step 5: Test in Totem

1. Restart the backend: `npm run dev`
2. Open Totem interface
3. Start new order
4. Select event/checkout
5. PIX payment option should now appear ✓

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| PIX still doesn't appear | Browser cache | Clear browser cache and refresh |
| Script fails with "Invalid credentials" | MP credentials are wrong | Verify credentials from MP dashboard |
| "No organization found" error | Database issue | Ensure database is running and connected |

---

## Issue #2: Digital Menu PIX Immediately Confirmed ✓

### Root Cause
**This is an architectural limitation, not a bug.**

**Why it happens**:
- **Totem checkout** uses `Order` model + `PaymentTransaction`
  - Full payment lifecycle with status tracking
  - Supports all payment methods (PIX, CARD, CASH, etc.)
  - Has dedicated checkout flow
  
- **Digital Menu checkout** uses `OnlineOrder` model without `PaymentTransaction`
  - Simplified order model for online stores
  - Only supports CASH and CARD_ON_DELIVERY methods originally
  - **PIX was added to UI but not to backend logic**

**See architectural difference**:
- Order with payment: [backend/src/modules/orders/services/create-order-service.ts](backend/src/modules/orders/services/create-order-service.ts)
- OnlineOrder without payment: [backend/src/modules/online-stores/services/create-online-order-service.ts](backend/src/modules/online-stores/services/create-online-order-service.ts)

### Current Behavior
1. User selects PIX in Digital Menu
2. Frontend calls `createPublicStoreOrder()`
3. Backend creates OnlineOrder but **skips payment transaction**
4. Order immediately shows as success (no payment collection)
5. PIX payment is never actually created with Mercado Pago

### How to Fix

Choose ONE approach based on business requirements:

#### Option A: Remove PIX from Digital Menu (Recommended - Simple)

**Rationale**: Digital Menu is designed for quick, simplified orders. PIX requires full payment integration.

**Implementation**:
1. Edit [frontend/src/routes/p.$slug.tsx](frontend/src/routes/p.$slug.tsx)
2. Remove PIX from `paymentMethods` filter (around line 150)
3. Keep only `CASH` and `CARD_ON_DELIVERY`

**Code change**:
```typescript
// Before:
const availablePaymentMethods = allPaymentMethods.filter(
  m => ['CASH', 'CARD_ON_DELIVERY', 'PIX_AUTOMATIC', 'PIX_MANUAL'].includes(m)
)

// After:
const availablePaymentMethods = allPaymentMethods.filter(
  m => ['CASH', 'CARD_ON_DELIVERY'].includes(m)
)
```

**Time to implement**: < 5 minutes
**Risk**: Low

#### Option B: Extend OnlineOrder to Support PIX (Advanced - Complex)

**Rationale**: Full feature parity between Totem and Digital Menu.

**Required changes**:
1. Add PaymentTransaction support to OnlineOrder flow
2. Update `create-online-order-service.ts` to create PaymentTransaction
3. Implement PIX checkout flow for Digital Menu
4. Update payment status handling for OnlineOrder
5. Add webhook handling for OnlineOrder payment updates

**Time to implement**: 4-6 hours
**Risk**: Medium (requires testing of payment flows)

**Note**: This is a significant architectural change and should be discussed with the product team.

### Recommendation

**Go with Option A** (Remove PIX from Digital Menu) because:
- Digital Menu is designed for quick transactions
- PIX requires full payment lifecycle management
- CASH (pay at location) and CARD_ON_DELIVERY (pay on arrival) cover most use cases
- Simpler to maintain and test

---

## Implementation Summary

### For Fixing Totem PIX (Issue #1)

```bash
# 1. Update backend/.env with real Mercado Pago credentials
# Edit the file and replace placeholder values

# 2. Run setup script
cd backend
npx tsx scripts/setup-mercado-pago-provider.ts

# 3. Verify configuration
npx tsx scripts/diagnose-pix-payment-flow.ts

# 4. Restart backend
npm run dev

# 5. Test in Totem interface
```

**Estimated time**: 15-30 minutes (depending on credential retrieval)

### For Fixing Digital Menu PIX (Issue #2)

**Option A (Recommended)**:
```bash
# 1. Edit frontend/src/routes/p.$slug.tsx
# 2. Remove PIX from paymentMethods filter
# 3. Test in Digital Menu

# Estimated time: 5-10 minutes
```

**Option B (Advanced)**:
- Requires 4-6 hours of development
- Multiple files need changes
- Comprehensive testing required

---

## Files Modified

### Created/Updated
- `backend/scripts/diagnose-pix-payment-flow.ts` - Diagnostic tool ✓
- `backend/scripts/setup-mercado-pago-provider.ts` - Setup script ✓
- **`backend/.env`** - Needs manual update with real credentials
- **`frontend/src/routes/p.$slug.tsx`** - If choosing Option A

### Referenced (No changes needed)
- `backend/src/modules/payments/services/get-checkout-payment-settings-service.ts`
- `backend/src/modules/orders/services/create-order-service.ts`
- `backend/src/modules/online-stores/services/create-online-order-service.ts`

---

## Testing Checklist

### After fixing Totem PIX:
- [ ] PIX option appears in Totem checkout
- [ ] Can select PIX payment method
- [ ] QR code displays for PIX payment
- [ ] Payment status updates correctly
- [ ] Order completes after PIX confirmation

### After fixing Digital Menu PIX:
- [ ] If Option A: PIX option removed from Digital Menu
- [ ] If Option B: Full payment flow working in Digital Menu

---

## References

- Mercado Pago Credentials: https://www.mercadopago.com.br/developers
- Mercado Pago API Docs: https://www.mercadopago.com.br/developers/pt-BR/docs
- System Payment Flow: `backend/src/modules/payments/`
- Order Models: `backend/prisma/schema.prisma` (search for `model Order` and `model OnlineOrder`)
