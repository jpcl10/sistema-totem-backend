import {
  PaymentMethod,
  PaymentProvider,
  PaymentTransactionStatus,
  Prisma
} from '@prisma/client'

export interface CreatePaymentProviderRequest {
  organizationId: string
  orderId: string
  amountInCents: number
  method: PaymentMethod
  description?: string | null
  payerEmail?: string | null
  payerName?: string | null
  expiresAt?: Date | string | null
  metadata?: Prisma.InputJsonValue | null
}

export interface CreatePaymentProviderResponse {
  provider: PaymentProvider
  status: PaymentTransactionStatus
  method: PaymentMethod
  amountInCents: number

  externalId?: string | null
  externalReference?: string | null

  qrCode?: string | null
  qrCodeBase64?: string | null
  pixCopyPaste?: string | null

  gatewayStatus?: string | null
  gatewayMessage?: string | null

  metadata?: Prisma.InputJsonValue | null
}

export interface CancelPaymentProviderRequest {
  externalId: string
  reason?: string | null
}

export interface RefundPaymentProviderRequest {
  externalId: string
  amountInCents?: number | null
  reason?: string | null
}

export interface PaymentProviderAdapter {
  createPayment(
    data: CreatePaymentProviderRequest
  ): Promise<CreatePaymentProviderResponse>

  cancelPayment?(
    data: CancelPaymentProviderRequest
  ): Promise<CreatePaymentProviderResponse>

  refundPayment?(
    data: RefundPaymentProviderRequest
  ): Promise<CreatePaymentProviderResponse>

  handleWebhook?(
    payload: unknown
  ): Promise<CreatePaymentProviderResponse>
}