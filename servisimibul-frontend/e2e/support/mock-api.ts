import type { Page, Route } from '@playwright/test'

type Role = 'ADMIN' | 'OPERATOR' | 'PARENT'
type ApprovalStatus = 'DRAFT' | 'PENDING' | 'CHANGES_REQUESTED' | 'APPROVED'

const operatorId = '99dd588e-2b72-419e-aa29-28fb97f8ad20'
const operatorUserId = '6e2973ac-0302-49a8-b519-563ec9861272'
const adminUserId = 'd28cc858-ed74-479a-b346-8b9cdccaaab8'
const schoolId = '6de54e65-6e04-4168-a1cb-967a98d7ec12'
const operatorSchoolId = '75ef6bb0-e313-43fb-a01c-c935774434b4'
const vehicleId = '11111111-1111-4111-8111-111111111111'
const offeringId = '33333333-3333-4333-8333-333333333333'
export const demandId = '481be36b-c8ee-4c03-868e-47bbc19b7735'
const parentUserId = 'b6322f08-1a1d-4ba6-b32a-a1c72f5aeacd'

const createdAt = '2026-10-18T10:00:00Z'

export interface MockApiState {
  operatorApprovalRequired?: boolean
  registered: boolean
  parentRegistered: boolean
  verified: boolean
  approvalStatus: ApprovalStatus
  active: boolean
  publiclyVisible: boolean
  businessName: string | null
  contactPhone: string
  description: string | null
  reviewHistory: Array<{
    id: string
    reviewedById: string
    decision: 'APPROVED' | 'CHANGES_REQUESTED'
    reason: string | null
    reviewedAt: string
  }>
  operatorSchoolAdded: boolean
  generalCoverage: number[]
  vehicles: Array<{
    id: string
    plate: string
    capacity: number
    active: boolean
    createdAt: string
    updatedAt: string
  }>
  offerings: Array<{
    id: string
    operatorSchoolId: string
    schoolId: string
    schoolName: string
    vehicleId: string
    vehiclePlate: string
    vehicleCapacity: number
    availableSeats: number | null
    description: string | null
    published: boolean
    coverage: ReturnType<typeof coverage>[]
    createdAt: string
    updatedAt: string
  }>
  tariff: ReturnType<typeof tariff>
  demandCreated: boolean
  parentSupport: null | {
    status: 'ACTIVE' | 'WITHDRAWN'
    needsMorning: boolean
    needsAfternoon: boolean
    reasons: string[]
  }
  demandComments: Array<{
    id: string
    body: string
    author: {
      role: 'PARENT' | 'OPERATOR'
      displayName: string
      operatorProfileId: string | null
    }
    canDelete: boolean
    createdAt: string
    updatedAt: string
  }>
  serviceResponse: null | {
    id: string
    status: 'ACTIVE' | 'WITHDRAWN'
    offersMorning: boolean
    offersAfternoon: boolean
    publicationVersion: number
    publicationEventId: string
    publishedAt: string
    withdrawnAt: string | null
  }
}

export function createMockApiState(): MockApiState {
  return {
    registered: false,
    parentRegistered: false,
    verified: false,
    approvalStatus: 'DRAFT',
    active: true,
    publiclyVisible: true,
    businessName: null,
    contactPhone: '+905321234567',
    description: null,
    reviewHistory: [],
    operatorSchoolAdded: false,
    generalCoverage: [],
    vehicles: [],
    offerings: [],
    tariff: tariff('v1'),
    demandCreated: false,
    parentSupport: null,
    demandComments: [],
    serviceResponse: null,
  }
}

export async function installMockApi(page: Page, state: MockApiState) {
  let role: Role | undefined

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v1', '')
    const method = request.method()

    if (path === '/auth/csrf' && method === 'GET') {
      return json(route, {
        headerName: 'X-CSRF-TOKEN',
        parameterName: '_csrf',
        token: 'e2e-csrf-token',
      })
    }
    if (path === '/auth/register' && method === 'POST') {
      state.registered = true
      return empty(route, 202)
    }
    if (path === '/auth/parent/register' && method === 'POST') {
      state.parentRegistered = true
      return empty(route, 202)
    }
    if (path === '/auth/verify-email' && method === 'POST') {
      state.verified = state.registered
      return empty(route)
    }
    if (path === '/auth/login' && method === 'POST') {
      const body = await request.postDataJSON()
      role =
        body.email === 'admin@example.com'
          ? 'ADMIN'
          : body.email === 'parent@example.com'
            ? 'PARENT'
            : 'OPERATOR'
      if (role === 'OPERATOR' && (!state.verified || !state.active)) {
        role = undefined
        return problem(route, 401, 'invalid_credentials')
      }
      return json(route, authUser(role, state))
    }
    if (path === '/auth/me' && method === 'GET') {
      if (!role || (role === 'OPERATOR' && !state.active)) {
        role = undefined
        return problem(route, 401, 'authentication_required')
      }
      return json(route, authUser(role, state))
    }
    if (path === '/auth/logout' && method === 'POST') {
      role = undefined
      return empty(route)
    }

    if (path === '/notifications/unread-count' && method === 'GET') {
      return requireAuthenticated(route, role, () =>
        json(route, { unreadCount: 0 }),
      )
    }
    if (path === '/notifications' && method === 'GET') {
      return requireAuthenticated(route, role, () =>
        json(route, pageResponse([], 20)),
      )
    }
    if (/^\/notifications\/[0-9a-f-]+\/read$/.test(path) && method === 'PUT') {
      return requireAuthenticated(route, role, () =>
        problem(route, 404, 'notification_not_found'),
      )
    }

    if (path === '/operator/profile' && method === 'GET') {
      return requireRole(route, role, 'OPERATOR', () =>
        json(route, profile(state)),
      )
    }
    if (path === '/operator/discovery-readiness' && method === 'GET') {
      return requireRole(route, role, 'OPERATOR', () =>
        json(route, discoveryReadiness(state)),
      )
    }
    if (path === '/operator/profile' && method === 'PATCH') {
      return requireRole(route, role, 'OPERATOR', async () => {
        const body = await request.postDataJSON()
        state.businessName = body.businessName?.trim() || null
        state.contactPhone = body.contactPhone
        state.description = body.description
        state.publiclyVisible = body.publiclyVisible
        return json(route, profile(state))
      })
    }
    if (path === '/operator/application/submit' && method === 'POST') {
      return requireRole(route, role, 'OPERATOR', () => {
        state.approvalStatus = 'PENDING'
        return json(route, profile(state))
      })
    }
    if (path === '/operator/application/resubmit' && method === 'POST') {
      return requireRole(route, role, 'OPERATOR', () => {
        state.approvalStatus = 'PENDING'
        return json(route, profile(state))
      })
    }

    if (path === '/admin/operators' && method === 'GET') {
      return requireRole(route, role, 'ADMIN', () =>
        json(route, pageResponse([profile(state)], 20)),
      )
    }
    if (path === '/admin/schools' && method === 'GET') {
      return requireRole(route, role, 'ADMIN', () =>
        json(route, pageResponse([school()], 20)),
      )
    }
    if (path === `/admin/operators/${operatorId}` && method === 'GET') {
      return requireRole(route, role, 'ADMIN', () =>
        json(route, applicationDetail(state)),
      )
    }
    if (
      path === `/admin/operators/${operatorId}/request-revision` &&
      method === 'POST'
    ) {
      return requireRole(route, role, 'ADMIN', async () => {
        const body = await request.postDataJSON()
        state.approvalStatus = 'CHANGES_REQUESTED'
        state.reviewHistory.push({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          reviewedById: adminUserId,
          decision: 'CHANGES_REQUESTED',
          reason: body.reason,
          reviewedAt: createdAt,
        })
        return json(route, applicationDetail(state))
      })
    }
    if (
      path === `/admin/operators/${operatorId}/approve` &&
      method === 'POST'
    ) {
      return requireRole(route, role, 'ADMIN', () => {
        state.approvalStatus = 'APPROVED'
        state.reviewHistory.push({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          reviewedById: adminUserId,
          decision: 'APPROVED',
          reason: null,
          reviewedAt: createdAt,
        })
        return json(route, applicationDetail(state))
      })
    }
    if (
      path === `/admin/operators/${operatorId}/suspend` &&
      method === 'POST'
    ) {
      return requireRole(route, role, 'ADMIN', () => {
        state.active = false
        return json(route, applicationDetail(state))
      })
    }

    if (path === '/provinces' && method === 'GET') {
      return json(route, [{ id: 34, code: '34', name: 'İstanbul' }])
    }
    if (path === '/schools' && method === 'GET') {
      if (!url.searchParams.has('sort')) {
        return json(route, pageResponse([school()], 50))
      }

      const districtId = url.searchParams.get('districtId')
      const query = normalizeSchoolSearch(url.searchParams.get('query') ?? '')
      const sort = url.searchParams.get('sort')
      const pageNumber = Number(url.searchParams.get('page') ?? '0')
      const pageSize = Number(url.searchParams.get('size') ?? '10')
      const matchingSchools = publicSchools()
        .filter((item) => !districtId || item.districtId === Number(districtId))
        .filter(
          (item) => !query || normalizeSchoolSearch(item.name).includes(query),
        )
        .sort((left, right) =>
          left.name.localeCompare(right.name, 'tr-TR', { sensitivity: 'base' }),
        )
      if (sort === 'name-desc') matchingSchools.reverse()

      const start = pageNumber * pageSize
      return json(route, {
        content: matchingSchools.slice(start, start + pageSize),
        page: pageNumber,
        size: pageSize,
        totalElements: matchingSchools.length,
        totalPages: Math.ceil(matchingSchools.length / pageSize),
      })
    }
    if (path === `/schools/${schoolId}` && method === 'GET') {
      return json(route, school())
    }
    if (path === '/districts' && method === 'GET') {
      return json(route, [
        { id: 10, provinceId: 34, name: 'Kadıköy' },
        { id: 11, provinceId: 34, name: 'Üsküdar' },
      ])
    }
    if (path === '/neighborhoods' && method === 'GET') {
      return json(
        route,
        url.searchParams.get('districtId') === '11'
          ? [{ id: 201, districtId: 11, name: 'Acıbadem' }]
          : [{ id: 101, districtId: 10, name: 'Moda' }],
      )
    }
    if (path === '/operator/schools' && method === 'GET') {
      return requireRole(route, role, 'OPERATOR', () =>
        json(route, state.operatorSchoolAdded ? [operatorSchool(state)] : []),
      )
    }
    if (path === '/operator/schools' && method === 'POST') {
      return requireRole(route, role, 'OPERATOR', () => {
        state.operatorSchoolAdded = true
        return json(route, operatorSchool(state), 201)
      })
    }
    if (
      path === `/operator/schools/${operatorSchoolId}/coverage` &&
      method === 'PUT'
    ) {
      return requireRole(route, role, 'OPERATOR', async () => {
        const body = await request.postDataJSON()
        state.generalCoverage = body.neighborhoodIds
        return json(route, operatorSchool(state))
      })
    }

    if (path === '/operator/vehicles' && method === 'GET') {
      return requireRole(route, role, 'OPERATOR', () =>
        json(route, state.vehicles),
      )
    }
    if (path === '/operator/vehicles' && method === 'POST') {
      return requireRole(route, role, 'OPERATOR', async () => {
        const body = await request.postDataJSON()
        const vehicle = {
          id: vehicleId,
          plate: body.plate,
          capacity: body.capacity,
          active: true,
          createdAt,
          updatedAt: createdAt,
        }
        state.vehicles.push(vehicle)
        return json(route, vehicle, 201)
      })
    }
    if (path === '/operator/offerings' && method === 'GET') {
      return requireRole(route, role, 'OPERATOR', () =>
        json(route, state.offerings),
      )
    }
    if (path === '/operator/offerings' && method === 'POST') {
      return requireRole(route, role, 'OPERATOR', async () => {
        const body = await request.postDataJSON()
        const vehicle = state.vehicles.find(
          (item) => item.id === body.vehicleId,
        )
        const offering = {
          id: offeringId,
          operatorSchoolId: body.operatorSchoolId,
          schoolId,
          schoolName: 'Örnek Okulu',
          vehicleId: body.vehicleId,
          vehiclePlate: vehicle?.plate ?? '34 ABC 123',
          vehicleCapacity: vehicle?.capacity ?? 16,
          availableSeats: body.availableSeats,
          description: body.description,
          published: false,
          coverage: [],
          createdAt,
          updatedAt: createdAt,
        }
        state.offerings.push(offering)
        return json(route, offering, 201)
      })
    }
    if (
      path === `/operator/offerings/${offeringId}/coverage` &&
      method === 'PUT'
    ) {
      return requireRole(route, role, 'OPERATOR', async () => {
        const body = await request.postDataJSON()
        const offering = state.offerings[0]
        if (!offering) return problem(route, 404, 'offering_not_found')
        offering.coverage = body.neighborhoodIds.map(coverage)
        return json(route, offering)
      })
    }
    if (
      path === `/operator/offerings/${offeringId}/publish` &&
      method === 'POST'
    ) {
      return requireRole(route, role, 'OPERATOR', () => {
        const offering = state.offerings[0]
        if (!offering) return problem(route, 404, 'offering_not_found')
        offering.published = true
        return json(route, offering)
      })
    }

    if (path === '/operators' && method === 'GET') {
      const neighborhoodId = Number(url.searchParams.get('neighborhoodId'))
      const eligible =
        state.verified &&
        state.active &&
        state.publiclyVisible &&
        state.approvalStatus === 'APPROVED' &&
        state.operatorSchoolAdded &&
        state.generalCoverage.includes(neighborhoodId)
      const publishedOfferings = state.offerings
        .filter(
          (offering) =>
            offering.published &&
            offering.coverage.some(
              (item) => item.neighborhoodId === neighborhoodId,
            ),
        )
        .map((offering) => ({
          offeringId: offering.id,
          availableSeats: offering.availableSeats,
          vehicleCapacity: offering.vehicleCapacity,
          description: offering.description,
        }))
      return json(
        route,
        pageResponse(
          eligible
            ? [
                {
                  operatorId,
                  businessName: state.businessName,
                  contactPhone: state.contactPhone,
                  description: state.description,
                  matchingSchool: { id: schoolId, name: 'Örnek Okulu' },
                  publishedOfferings,
                },
              ]
            : [],
          10,
        ),
      )
    }
    if (path === '/demands' && method === 'GET') {
      return json(
        route,
        pageResponse(
          state.demandCreated ? [demandResponse(state, role)] : [],
          10,
        ),
      )
    }
    if (path === '/demands' && method === 'POST') {
      return requireRole(route, role, 'PARENT', async () => {
        const body = await request.postDataJSON()
        const created = !state.demandCreated
        if (created) {
          state.demandCreated = true
          state.parentSupport = {
            status: 'ACTIVE',
            needsMorning: body.needsMorning,
            needsAfternoon: body.needsAfternoon,
            reasons: body.reasons,
          }
        }
        return json(
          route,
          { created, demand: demandResponse(state, role) },
          created ? 201 : 200,
        )
      })
    }
    if (path === `/demands/${demandId}` && method === 'GET') {
      return state.demandCreated
        ? json(route, demandResponse(state, role))
        : problem(route, 404, 'demand_not_found')
    }
    if (path === `/demands/${demandId}/comments` && method === 'GET') {
      return json(route, pageResponse(state.demandComments, 10))
    }
    if (path === `/demands/${demandId}/comments` && method === 'POST') {
      if (role !== 'PARENT' && role !== 'OPERATOR') {
        return problem(route, 401, 'authentication_required')
      }
      if (role === 'PARENT' && state.parentSupport?.status !== 'ACTIVE') {
        return problem(route, 403, 'active_support_required')
      }
      const body = await request.postDataJSON()
      const comment = {
        id: '6b78776f-ad3f-4580-9d69-839a14786aed',
        body: body.body,
        author: {
          role,
          displayName: role === 'PARENT' ? 'Veli' : 'Servis işletmecisi',
          operatorProfileId: null,
        },
        canDelete: true,
        createdAt,
        updatedAt: createdAt,
      }
      state.demandComments.unshift(comment)
      return json(route, comment, 201)
    }
    if (
      path.startsWith(`/demands/${demandId}/comments/`) &&
      method === 'DELETE'
    ) {
      const commentId = path.split('/').at(-1)
      state.demandComments = state.demandComments.filter(
        (comment) => comment.id !== commentId,
      )
      return empty(route)
    }
    if (path === `/demands/${demandId}/responses` && method === 'GET') {
      const response = state.serviceResponse
      return json(
        route,
        pageResponse(
          response?.status === 'ACTIVE' && serviceResponseEligible(state)
            ? [publicServiceResponse(state, response)]
            : [],
          20,
        ),
      )
    }
    if (path === `/operator/demands/${demandId}/response` && method === 'GET') {
      return requireRole(route, role, 'OPERATOR', () => {
        const blockers = serviceResponseBlockers(state)
        return json(route, {
          demandId,
          eligible: blockers.length === 0,
          blockers,
          response: state.serviceResponse
            ? operatorServiceResponse(state, blockers.length === 0)
            : null,
        })
      })
    }
    if (
      path === `/operator/demands/${demandId}/response` &&
      method === 'POST'
    ) {
      return requireRole(route, role, 'OPERATOR', async () => {
        const blockers = serviceResponseBlockers(state)
        if (blockers.length > 0) {
          return problem(route, 409, 'operator_not_eligible')
        }
        if (state.serviceResponse?.status === 'ACTIVE') {
          return json(route, {
            published: false,
            response: operatorServiceResponse(state, true),
          })
        }
        const body = await request.postDataJSON()
        const publicationVersion =
          (state.serviceResponse?.publicationVersion ?? 0) + 1
        state.serviceResponse = {
          id: 'de3abec5-1adc-4267-a7f1-dc06e8164655',
          status: 'ACTIVE',
          offersMorning: body.offersMorning,
          offersAfternoon: body.offersAfternoon,
          publicationVersion,
          publicationEventId:
            publicationVersion === 1
              ? 'c1f54a9d-cf2e-4206-9016-644372685b74'
              : 'e2f8ee8a-970c-451b-bd7f-287dc02f5ed6',
          publishedAt: createdAt,
          withdrawnAt: null,
        }
        return json(route, {
          published: true,
          response: operatorServiceResponse(state, true),
        })
      })
    }
    if (
      path === `/operator/demands/${demandId}/response` &&
      method === 'DELETE'
    ) {
      return requireRole(route, role, 'OPERATOR', () => {
        if (!state.serviceResponse) {
          return problem(route, 404, 'demand_service_response_not_found')
        }
        state.serviceResponse.status = 'WITHDRAWN'
        state.serviceResponse.withdrawnAt = createdAt
        return json(route, operatorServiceResponse(state, false))
      })
    }
    if (
      path === `/demands/${demandId}/support` &&
      (method === 'POST' || method === 'PUT')
    ) {
      return requireRole(route, role, 'PARENT', async () => {
        const body = await request.postDataJSON()
        state.parentSupport = {
          status: 'ACTIVE',
          needsMorning: body.needsMorning,
          needsAfternoon: body.needsAfternoon,
          reasons: body.reasons,
        }
        return json(route, demandResponse(state, role))
      })
    }
    if (path === `/demands/${demandId}/support` && method === 'DELETE') {
      return requireRole(route, role, 'PARENT', () => {
        if (state.parentSupport) state.parentSupport.status = 'WITHDRAWN'
        return empty(route)
      })
    }
    if (path === '/tariffs' && method === 'GET') {
      return json(route, state.tariff)
    }
    if (path === '/admin/tariffs/34' && method === 'PUT') {
      return requireRole(route, role, 'ADMIN', async () => {
        const body = await request.postDataJSON()
        state.tariff = body.tariff
        return json(route, state.tariff)
      })
    }

    return problem(route, 404, 'mock_route_not_found')
  })
}

function authUser(role: Role, state: MockApiState) {
  return {
    id:
      role === 'ADMIN'
        ? adminUserId
        : role === 'PARENT'
          ? parentUserId
          : operatorUserId,
    email:
      role === 'ADMIN'
        ? 'admin@example.com'
        : role === 'PARENT'
          ? 'parent@example.com'
          : 'operator@example.com',
    role,
    operatorApprovalRequired: state.operatorApprovalRequired ?? true,
    approvalStatus: role === 'OPERATOR' ? state.approvalStatus : null,
  }
}

function demandResponse(state: MockApiState, role: Role | undefined) {
  const support = role === 'PARENT' ? state.parentSupport : null
  const active = support?.status === 'ACTIVE'
  return {
    id: demandId,
    status: 'OPEN',
    closureReason: null,
    closedAt: null,
    academicYear: '2026-2027',
    createdAt,
    updatedAt: createdAt,
    school: { id: schoolId, name: 'Örnek Okulu' },
    neighborhood: {
      id: 201,
      name: 'Acıbadem',
      districtId: 11,
      districtName: 'Üsküdar',
      provinceId: 34,
      provinceCode: '34',
      provinceName: 'İstanbul',
    },
    supporterCount: active ? 1 : 0,
    morningCount: active && support.needsMorning ? 1 : 0,
    afternoonCount: active && support.needsAfternoon ? 1 : 0,
    reasonCounts: active
      ? support.reasons.map((reason) => ({ reason, count: 1 }))
      : [],
    currentUserSupport:
      support === null
        ? null
        : {
            id: 'b6586a84-6094-4ddb-80ea-e36756cf1915',
            ...support,
          },
  }
}

function serviceResponseEligible(state: MockApiState) {
  return serviceResponseBlockers(state).length === 0
}

function serviceResponseBlockers(state: MockApiState) {
  const blockers: string[] = []
  if (!state.verified) blockers.push('ACCOUNT_EMAIL_UNVERIFIED')
  if (!state.active) blockers.push('ACCOUNT_DISABLED', 'PROFILE_INACTIVE')
  if (!state.publiclyVisible) blockers.push('PROFILE_HIDDEN')
  if (state.approvalStatus !== 'APPROVED') blockers.push('APPROVAL_REQUIRED')
  if (!state.operatorSchoolAdded) blockers.push('SCHOOL_NOT_LINKED')
  else if (!state.generalCoverage.includes(201))
    blockers.push('COVERAGE_MISSING')
  return blockers
}

function operatorServiceResponse(
  state: MockApiState,
  currentlyPublic: boolean,
) {
  const response = state.serviceResponse
  if (!response) throw new Error('Mock service response is missing')
  return {
    ...response,
    currentlyPublic: response.status === 'ACTIVE' && currentlyPublic,
  }
}

function publicServiceResponse(
  state: MockApiState,
  response: NonNullable<MockApiState['serviceResponse']>,
) {
  return {
    id: response.id,
    publicationEventId: response.publicationEventId,
    publicationVersion: response.publicationVersion,
    operatorId,
    businessName: state.businessName,
    contactPhone: state.contactPhone,
    offersMorning: response.offersMorning,
    offersAfternoon: response.offersAfternoon,
    publishedAt: response.publishedAt,
  }
}

function profile(state: MockApiState) {
  return {
    id: operatorId,
    businessName: state.businessName,
    contactPhone: state.contactPhone,
    description: state.description,
    approvalStatus: state.approvalStatus,
    active: state.active,
    publiclyVisible: state.publiclyVisible,
    createdAt,
    updatedAt: createdAt,
  }
}

function applicationDetail(state: MockApiState) {
  return { profile: profile(state), reviewHistory: state.reviewHistory }
}

function school() {
  return {
    id: schoolId,
    neighborhoodId: 101,
    neighborhoodName: 'Moda',
    districtId: 10,
    districtName: 'Kadıköy',
    provinceId: 34,
    provinceCode: '34',
    provinceName: 'İstanbul',
    name: 'Örnek Okulu',
    address: null,
    sourceName: null,
    sourceCode: null,
    active: true,
  }
}

function publicSchools() {
  return [
    {
      ...school(),
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Atatürk İlkokulu',
    },
    school(),
    {
      ...school(),
      id: '10000000-0000-4000-8000-000000000003',
      neighborhoodId: 201,
      neighborhoodName: 'Acıbadem',
      districtId: 11,
      districtName: 'Üsküdar',
      name: 'Zübeyde Hanım İlkokulu',
    },
  ]
}

function normalizeSchoolSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
}

function operatorSchool(state: MockApiState) {
  return {
    id: operatorSchoolId,
    schoolId,
    schoolName: 'Örnek Okulu',
    schoolNeighborhoodId: 101,
    schoolDistrictId: 10,
    schoolProvinceId: 34,
    schoolProvinceCode: '34',
    schoolProvinceName: 'İstanbul',
    schoolActive: true,
    active: true,
    coverage: state.generalCoverage.map(coverage),
  }
}

function discoveryReadiness(state: MockApiState) {
  const hasEligibleSchoolCoverage =
    state.operatorSchoolAdded && state.generalCoverage.length > 0
  const approvalSatisfied = state.approvalStatus === 'APPROVED'
  return {
    discoveryEligible:
      state.verified &&
      state.active &&
      state.publiclyVisible &&
      approvalSatisfied &&
      hasEligibleSchoolCoverage,
    emailVerified: state.verified,
    accountEnabled: state.active,
    profileActive: state.active,
    publiclyVisible: state.publiclyVisible,
    approvalRequired: true,
    approvalSatisfied,
    hasActiveSchoolRelationship: state.operatorSchoolAdded,
    hasEligibleSchoolCoverage,
    schools: state.operatorSchoolAdded
      ? [
          {
            operatorSchoolId,
            schoolId,
            schoolName: 'Örnek Okulu',
            relationshipActive: true,
            schoolActive: true,
            validCoverageCount: state.generalCoverage.length,
            contributesToDiscovery: hasEligibleSchoolCoverage,
          },
        ]
      : [],
  }
}

function coverage(neighborhoodId: number) {
  const uskudar = neighborhoodId === 201
  return {
    neighborhoodId,
    neighborhoodName: uskudar ? 'Acıbadem' : 'Moda',
    districtId: uskudar ? 11 : 10,
    districtName: uskudar ? 'Üsküdar' : 'Kadıköy',
    provinceId: 34,
    provinceCode: '34',
    provinceName: 'İstanbul',
  }
}

function tariff(version: string) {
  return {
    provinceCode: '34',
    provinceName: 'İstanbul',
    authority: 'İstanbul Büyükşehir Belediyesi Meclisi',
    academicYear: '2026-2027',
    currency: 'TRY' as const,
    effectiveFrom: '2026-07-20',
    effectiveTo: null,
    sourceTitle: '17.07.2026 tarih ve 813 sayılı İBB Meclis kararı',
    officialSourceUrl: 'https://fixtures.invalid/ukome.pdf',
    version,
    additionalKilometerRule: {
      startsAfterDistanceKm: 25,
      monthlyAmountPerKilometerKurus: 8_799,
    },
    notes: [
      'Tutarlar KDV dahil azami ücretlerdir.',
      'Okul öncesi ve ilköğretim taşıma ücretine en fazla %35 rehber personel ücreti eklenebilir.',
      'Aynı okula giden kardeşlerde ikinci çocuk için %10 indirim uygulanır.',
    ],
    bands: [
      {
        minDistanceKm: 0,
        maxDistanceKm: 1,
        amountKurus: 445_600,
        annualAmountKurus: 3_997_000,
      },
      {
        minDistanceKm: 1,
        maxDistanceKm: 25,
        amountKurus: 1_043_600,
        annualAmountKurus: 9_361_000,
      },
    ],
  }
}

function pageResponse<T>(content: T[], size: number) {
  return {
    content,
    page: 0,
    size,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
  }
}

function requireRole(
  route: Route,
  actual: Role | undefined,
  expected: Role,
  action: () => unknown,
) {
  return actual === expected
    ? action()
    : problem(route, actual ? 403 : 401, 'authentication_required')
}

function requireAuthenticated(
  route: Route,
  actual: Role | undefined,
  action: () => unknown,
) {
  return actual ? action() : problem(route, 401, 'authentication_required')
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

function empty(route: Route, status = 204) {
  return route.fulfill({ status, body: '' })
}

function problem(route: Route, status: number, code: string) {
  return json(
    route,
    {
      title: status === 404 ? 'Not found' : 'Authentication required',
      status,
      detail: status === 404 ? 'Mock route not found.' : 'Please sign in.',
      code,
    },
    status,
  )
}
