import { fireEvent, render, screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/server'
import { PublicTariffReference, TariffDetails } from './PublicTariffReference'
import type { Tariff } from './tariff-api'

describe('public tariff reference', () => {
  it('presents real monthly and annual amounts with source metadata', () => {
    render(<TariffDetails tariff={tariff()} periodSwitcher />)

    expect(screen.getByText('₺4.456,00')).toBeInTheDocument()
    expect(screen.queryByText('₺39.970,00')).not.toBeInTheDocument()
    expect(screen.getByText('25 km üzeri')).toBeInTheDocument()
    expect(screen.getByText(/Her km için \+₺87,99/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Yıllık' }))

    expect(screen.getByText('₺39.970,00')).toBeInTheDocument()
    expect(screen.queryByText('25 km üzeri')).not.toBeInTheDocument()
    expect(
      screen.getByText(/ek kilometre ücreti kaynakta yalnızca aylık/i),
    ).toHaveTextContent('+₺87,99 / km')
    expect(screen.getByText('2026-2027 · İstanbul')).toBeInTheDocument()
    expect(
      screen.getByText('20.07.2026 tarihinden itibaren'),
    ).toBeInTheDocument()
    expect(screen.getByText('2026-2027-ibb-813')).toBeInTheDocument()
    expect(screen.getByText(/813 sayılı İBB Meclis kararı/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Resmî belgeyi aç/ }),
    ).toHaveAttribute('href', 'https://fixtures.invalid/ukome.pdf')
  })

  it('does not invent annual or additional-kilometre amounts', () => {
    const withoutOptionalAmounts = tariff()
    withoutOptionalAmounts.additionalKilometerRule = null
    withoutOptionalAmounts.bands = withoutOptionalAmounts.bands.map((band) => ({
      ...band,
      annualAmountKurus: null,
    }))

    render(<TariffDetails tariff={withoutOptionalAmounts} periodSwitcher />)

    expect(screen.getByRole('button', { name: 'Yıllık' })).toBeDisabled()
    expect(screen.queryByText(/Her km için/)).not.toBeInTheDocument()
    expect(screen.queryByText('₺39.970,00')).not.toBeInTheDocument()
  })

  it('never shows a stale tariff after the selected province changes', async () => {
    server.use(
      http.get('/api/v1/tariffs', async ({ request }) => {
        const provinceCode = new URL(request.url).searchParams.get(
          'provinceCode',
        )
        await delay(provinceCode === '34' ? 80 : 5)
        return HttpResponse.json(
          provinceCode === '34'
            ? tariff()
            : { ...tariff(), provinceCode: '06', provinceName: 'Ankara' },
        )
      }),
    )

    const view = render(<PublicTariffReference provinceCode="34" />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Resmî tarife bilgisi yükleniyor',
    )

    view.rerender(<PublicTariffReference provinceCode="06" />)

    expect(await screen.findByText('2026-2027 · Ankara')).toBeInTheDocument()
    await delay(100)
    expect(screen.queryByText('2026-2027 · İstanbul')).not.toBeInTheDocument()
  })
})

function tariff(): Tariff {
  return {
    provinceCode: '34',
    provinceName: 'İstanbul',
    authority: 'İstanbul Büyükşehir Belediyesi Meclisi',
    academicYear: '2026-2027',
    currency: 'TRY',
    effectiveFrom: '2026-07-20',
    effectiveTo: null,
    sourceTitle: '17.07.2026 tarih ve 813 sayılı İBB Meclis kararı',
    officialSourceUrl: 'https://fixtures.invalid/ukome.pdf',
    version: '2026-2027-ibb-813',
    additionalKilometerRule: {
      startsAfterDistanceKm: 25,
      monthlyAmountPerKilometerKurus: 8_799,
    },
    notes: ['Tutarlar KDV dahil azami ücretlerdir.'],
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
