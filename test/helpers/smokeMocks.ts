import { vi, type Mock } from 'vitest'
import { CopilotAPI } from '@/utils/copilotAPI'
import { ProductStatus } from '@/app/api/core/types/product'
import { SMOKE_PORTAL_ID } from '@test/helpers/smokeSeed'

export interface SmokeCopilotHandle {
  copilot: {
    getTokenPayload: Mock
    getProduct: Mock
  }
  productId: string
  priceId: string
  productName: string
}

/**
 * Mocks CopilotAPI with just enough fidelity for the price.created flow:
 * `getTokenPayload` returns the smoke portal's workspaceId so authenticate()
 * resolves; `getProduct` returns a `ProductResponse`-shaped object whose
 * `name` embeds the runId so the QB item name is unique per run and doesn't
 * collide with archived items from prior runs.
 *
 * The shape is enforced at the wrapper level by `ProductResponseSchema.parse`
 * in src/utils/copilotAPI.ts — if Copilot's real schema ever diverges, we'd
 * see it in the mocked integration tests first.
 */
// Stable UUID for the smoke Copilot product. Must be a valid UUID because
// qb_product_sync.product_id is typed as UUID. A fixed value is safe — the
// runId-suffixed product name is what makes each QB item unique, not this ID.
const SMOKE_PRODUCT_UUID = '00000000-0000-4000-8000-000000000001'

export function installSmokeCopilotMock(opts: {
  runId: string
  productId?: string
  priceId?: string
  productBaseName?: string
}): SmokeCopilotHandle {
  const productId = opts.productId ?? SMOKE_PRODUCT_UUID
  const priceId = opts.priceId ?? 'smoke-price-0001'
  const productName = `${opts.productBaseName ?? 'Smoke Product'} [smoke-${opts.runId}]`
  const now = new Date().toISOString()

  const copilot = {
    getTokenPayload: vi.fn().mockResolvedValue({
      workspaceId: SMOKE_PORTAL_ID,
      internalUserId: 'smoke-internal-user-id',
    }),
    getProduct: vi.fn().mockResolvedValue({
      id: productId,
      name: productName,
      imageUrls: [],
      description: 'Smoke test product',
      status: ProductStatus.ACTIVE,
      object: 'product',
      createdAt: now,
      updatedAt: now,
    }),
  }

  vi.mocked(CopilotAPI).mockImplementation(function (
    this: unknown,
  ): CopilotAPI {
    return copilot as unknown as CopilotAPI
  } as unknown as typeof CopilotAPI)

  return { copilot, productId, priceId, productName }
}
