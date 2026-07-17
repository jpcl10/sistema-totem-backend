import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import { presentCustomer } from '../presenters/customer-presenter.js'
import {
  addCustomerInterestSchema,
  createCustomerAddressSchema,
  createCustomerSchema,
  createInterestSchema,
  customerAddressParamsSchema,
  customerInterestParamsSchema,
  customerParamsSchema,
  interestParamsSchema,
  listCustomersQuerySchema,
  listInterestsQuerySchema,
  updateCustomerAddressSchema,
  updateCustomerAddressStatusSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
  updateInterestSchema,
  updateInterestStatusSchema
} from '../schemas/customer-schemas.js'
import {
  AddCustomerInterestService,
  CreateCustomerAddressService,
  CreateCustomerService,
  CreateInterestService,
  GetCustomerService,
  ListCustomerAddressesService,
  ListCustomersService,
  ListInterestsService,
  RemoveCustomerInterestService,
  UpdateCustomerAddressService,
  UpdateCustomerAddressStatusService,
  UpdateCustomerService,
  UpdateCustomerStatusService,
  UpdateInterestService,
  UpdateInterestStatusService
} from '../services/customer-services.js'

function handleCustomerError(error: unknown, reply: FastifyReply) {
  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      message: 'Invalid request',
      issues: error.issues
    })
  }

  if (error instanceof Error) {
    if (
      error.message.includes('not found') ||
      error.message === 'Customer or interest not found'
    ) {
      return reply.status(404).send({ message: error.message })
    }

    if (
      error.message.includes('already exists') ||
      error.message.includes('Unique constraint failed')
    ) {
      return reply.status(409).send({ message: error.message })
    }
  }

  throw error
}

export async function listCustomersController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const query = listCustomersQuerySchema.parse(request.query)
    const service = new ListCustomersService()

    return reply.send(await service.execute({ organizationId, ...query }))
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function createCustomerController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const data = createCustomerSchema.parse(request.body)
    const service = new CreateCustomerService()

    const { customer } = await service.execute({
      organizationId,
      userId: request.user.sub,
      data
    })

    return reply.status(201).send({ customer })
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function getCustomerController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { customerId } = customerParamsSchema.parse(request.params)
    const service = new GetCustomerService()

    const { customer, summary } = await service.execute({
      organizationId,
      customerId
    })

    return reply.send({
      ...presentCustomer(customer),
      summary
    })
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function updateCustomerController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { customerId } = customerParamsSchema.parse(request.params)
    const data = updateCustomerSchema.parse(request.body)
    const service = new UpdateCustomerService()

    const { customer } = await service.execute({
      organizationId,
      userId: request.user.sub,
      customerId,
      data
    })

    return reply.send({ customer })
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function updateCustomerStatusController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { customerId } = customerParamsSchema.parse(request.params)
    const { active } = updateCustomerStatusSchema.parse(request.body)
    const service = new UpdateCustomerStatusService()

    return reply.send(
      await service.execute({
        organizationId,
        userId: request.user.sub,
        customerId,
        active
      })
    )
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function listCustomerAddressesController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { customerId } = customerParamsSchema.parse(request.params)
    const service = new ListCustomerAddressesService()

    return reply.send(await service.execute({ organizationId, customerId }))
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function createCustomerAddressController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { customerId } = customerParamsSchema.parse(request.params)
    const data = createCustomerAddressSchema.parse(request.body)
    const service = new CreateCustomerAddressService()

    const { address } = await service.execute({
      organizationId,
      userId: request.user.sub,
      customerId,
      data
    })

    return reply.status(201).send({ address })
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function updateCustomerAddressController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { customerId, addressId } = customerAddressParamsSchema.parse(request.params)
    const data = updateCustomerAddressSchema.parse(request.body)
    const service = new UpdateCustomerAddressService()

    const { address } = await service.execute({
      organizationId,
      userId: request.user.sub,
      customerId,
      addressId,
      data
    })

    return reply.send({ address })
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function updateCustomerAddressStatusController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { customerId, addressId } = customerAddressParamsSchema.parse(request.params)
    const { active } = updateCustomerAddressStatusSchema.parse(request.body)
    const service = new UpdateCustomerAddressStatusService()

    return reply.send(
      await service.execute({
        organizationId,
        userId: request.user.sub,
        customerId,
        addressId,
        active
      })
    )
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function listInterestsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const query = listInterestsQuerySchema.parse(request.query)
    const service = new ListInterestsService()

    return reply.send(await service.execute({ organizationId, ...query }))
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function createInterestController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const data = createInterestSchema.parse(request.body)
    const service = new CreateInterestService()

    const { interest } = await service.execute({
      organizationId,
      userId: request.user.sub,
      ...data
    })

    return reply.status(201).send({ interest })
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function updateInterestController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { interestId } = interestParamsSchema.parse(request.params)
    const data = updateInterestSchema.parse(request.body)
    const service = new UpdateInterestService()

    const { interest } = await service.execute({
      organizationId,
      userId: request.user.sub,
      interestId,
      ...data
    })

    return reply.send({ interest })
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function updateInterestStatusController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { interestId } = interestParamsSchema.parse(request.params)
    const { active } = updateInterestStatusSchema.parse(request.body)
    const service = new UpdateInterestStatusService()

    return reply.send(
      await service.execute({
        organizationId,
        userId: request.user.sub,
        interestId,
        active
      })
    )
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function addCustomerInterestController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { customerId } = customerParamsSchema.parse(request.params)
    const data = addCustomerInterestSchema.parse(request.body)
    const service = new AddCustomerInterestService()

    const { customerInterest } = await service.execute({
      organizationId,
      userId: request.user.sub,
      customerId,
      ...data
    })

    return reply.status(201).send({ customerInterest })
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}

export async function removeCustomerInterestController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const { customerId, interestId } = customerInterestParamsSchema.parse(request.params)
    const service = new RemoveCustomerInterestService()

    return reply.send(
      await service.execute({
        organizationId,
        userId: request.user.sub,
        customerId,
        interestId
      })
    )
  } catch (error) {
    return handleCustomerError(error, reply)
  }
}
