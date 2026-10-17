import { z } from 'zod'
import { apiRequest } from '../../api/client'

const coverageSchema = z.object({
  neighborhoodId: z.number().int().positive(),
  neighborhoodName: z.string(),
  districtId: z.number().int().positive(),
  districtName: z.string(),
  provinceId: z.number().int().positive(),
  provinceCode: z.string(),
  provinceName: z.string(),
})

const vehicleSchema = z.object({
  id: z.string().uuid(),
  plate: z.string(),
  capacity: z.number().int().positive(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const offeringSchema = z.object({
  id: z.string().uuid(),
  operatorSchoolId: z.string().uuid(),
  schoolId: z.string().uuid(),
  schoolName: z.string(),
  vehicleId: z.string().uuid(),
  vehiclePlate: z.string(),
  vehicleCapacity: z.number().int().positive(),
  availableSeats: z.number().int().nonnegative().nullable(),
  description: z.string().nullable(),
  published: z.boolean(),
  coverage: z.array(coverageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Vehicle = z.infer<typeof vehicleSchema>
export type ServiceOffering = z.infer<typeof offeringSchema>

export interface VehicleWriteRequest {
  plate: string
  capacity: number
}

export interface OfferingWriteRequest {
  operatorSchoolId: string
  vehicleId: string
  availableSeats: number | null
  description: string | null
}

export function getVehicles(): Promise<Vehicle[]> {
  return apiRequest('/operator/vehicles', {
    requiresSession: true,
    schema: z.array(vehicleSchema),
  })
}

export function createVehicle(request: VehicleWriteRequest): Promise<Vehicle> {
  return apiRequest('/operator/vehicles', {
    method: 'POST',
    json: request,
    requiresSession: true,
    schema: vehicleSchema,
  })
}

export function updateVehicle(
  id: string,
  request: VehicleWriteRequest & { active?: boolean },
): Promise<Vehicle> {
  return apiRequest(`/operator/vehicles/${id}`, {
    method: 'PATCH',
    json: request,
    requiresSession: true,
    schema: vehicleSchema,
  })
}

export function deactivateVehicle(id: string): Promise<Vehicle> {
  return apiRequest(`/operator/vehicles/${id}/deactivate`, {
    method: 'POST',
    requiresSession: true,
    schema: vehicleSchema,
  })
}

export function getOfferings(): Promise<ServiceOffering[]> {
  return apiRequest('/operator/offerings', {
    requiresSession: true,
    schema: z.array(offeringSchema),
  })
}

export function createOffering(
  request: OfferingWriteRequest,
): Promise<ServiceOffering> {
  return apiRequest('/operator/offerings', {
    method: 'POST',
    json: request,
    requiresSession: true,
    schema: offeringSchema,
  })
}

export function updateOffering(
  id: string,
  request: OfferingWriteRequest,
): Promise<ServiceOffering> {
  return apiRequest(`/operator/offerings/${id}`, {
    method: 'PATCH',
    json: request,
    requiresSession: true,
    schema: offeringSchema,
  })
}

export function replaceOfferingCoverage(
  id: string,
  neighborhoodIds: number[],
): Promise<ServiceOffering> {
  return apiRequest(`/operator/offerings/${id}/coverage`, {
    method: 'PUT',
    json: { neighborhoodIds },
    requiresSession: true,
    schema: offeringSchema,
  })
}

export function setOfferingPublished(
  id: string,
  published: boolean,
): Promise<ServiceOffering> {
  return apiRequest(
    `/operator/offerings/${id}/${published ? 'publish' : 'unpublish'}`,
    {
      method: 'POST',
      requiresSession: true,
      schema: offeringSchema,
    },
  )
}
