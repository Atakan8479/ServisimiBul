import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicLayout } from '../../components/layouts'
import {
  PrivacyNoticePage,
  PublicRequestEntryPage,
  TermsPage,
} from './LegalPages'

afterEach(() => {
  vi.unstubAllEnvs()
})

function renderPrivacyNotice() {
  render(
    <MemoryRouter initialEntries={['/privacy/notice']}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/privacy/notice" element={<PrivacyNoticePage />} />
          <Route
            path="/privacy/requests"
            element={<PublicRequestEntryPage />}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function renderRequestEntry() {
  render(
    <MemoryRouter initialEntries={['/privacy/requests']}>
      <Routes>
        <Route path="/parent/login" element={<h1>Veli girişi</h1>} />
        <Route path="/operator/login" element={<h1>İşletmeci girişi</h1>} />
        <Route path="/privacy/requests" element={<PublicRequestEntryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderTerms() {
  render(
    <MemoryRouter initialEntries={['/terms']}>
      <Routes>
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PrivacyNoticePage', () => {
  it('shows the pending state instead of any notice text by default', () => {
    renderPrivacyNotice()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Gizlilik ve kişisel veriler',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Aydınlatma metni henüz yayında değil',
    )
  })

  it('still shows the pending state when the publish flag is on, since no approved notice exists', () => {
    vi.stubEnv('VITE_LEGAL_NOTICES_PUBLISHED', 'true')
    renderPrivacyNotice()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Aydınlatma metni henüz yayında değil',
    )
  })

  it('links to the public request-entry route', () => {
    renderPrivacyNotice()

    expect(
      screen.getByRole('link', { name: 'başvuru yolunu görüntüleyin' }),
    ).toHaveAttribute('href', '/privacy/requests')
  })
})

describe('PublicRequestEntryPage', () => {
  it('directs anonymous visitors to the existing login routes without inventing a contact channel', () => {
    renderRequestEntry()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Kişisel veri başvuru yolu',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'bir e-posta veya KEP adresi içermez',
    )
    expect(screen.getByRole('link', { name: 'Veli girişi' })).toHaveAttribute(
      'href',
      '/parent/login',
    )
    expect(
      screen.getByRole('link', { name: 'İşletmeci girişi' }),
    ).toHaveAttribute('href', '/operator/login')
  })

  it('renders a fail-closed form that cannot collect or submit personal data', () => {
    renderRequestEntry()

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Kişisel veri başvuru formu',
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Başvuru konusu')).toBeDisabled()
    expect(screen.getByLabelText('Başvurunuzu açıklayın')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Başvuruyu gönder' }),
    ).toBeDisabled()
    expect(
      screen.getByText('Form şu anda bilgi göndermez veya kaydetmez.'),
    ).toBeInTheDocument()
  })

  it('never implies that signing in starts or continues a personal data request', () => {
    renderRequestEntry()

    expect(screen.queryByText(/devam edebilirsiniz/i)).not.toBeInTheDocument()
    expect(
      screen.getByText(/oturum açmak kişisel veri başvurusu başlatmaz/i),
    ).toBeInTheDocument()
  })

  it('actually navigates to the parent login route when clicked', () => {
    renderRequestEntry()

    fireEvent.click(screen.getByRole('link', { name: 'Veli girişi' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Veli girişi' }),
    ).toBeInTheDocument()
  })

  it('actually navigates to the operator login route when clicked', () => {
    renderRequestEntry()

    fireEvent.click(screen.getByRole('link', { name: 'İşletmeci girişi' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'İşletmeci girişi' }),
    ).toBeInTheDocument()
  })
})

describe('TermsPage', () => {
  it('shows a clearly pending state instead of terms text by default', () => {
    renderTerms()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Kullanım koşulları' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Kullanım koşulları henüz yayında değil',
    )
  })

  it('stays pending when publication is enabled without approved terms', () => {
    vi.stubEnv('VITE_LEGAL_NOTICES_PUBLISHED', 'true')
    renderTerms()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Kullanım koşulları henüz yayında değil',
    )
  })
})

describe('public footer navigation', () => {
  it('exposes the legal and request-entry links from every public page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<h1>Okulunu seç</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const footer = screen.getByRole('contentinfo', { hidden: true })
    expect(
      within(footer).getByRole('link', {
        name: 'Gizlilik ve kişisel veriler',
        hidden: true,
      }),
    ).toHaveAttribute('href', '/privacy/notice')
    expect(
      within(footer).getByRole('link', {
        name: 'Kullanım koşulları',
        hidden: true,
      }),
    ).toHaveAttribute('href', '/terms')
    expect(
      within(footer).getByRole('link', {
        name: 'Kişisel veri başvuru yolu',
        hidden: true,
      }),
    ).toHaveAttribute('href', '/privacy/requests')
  })
})
