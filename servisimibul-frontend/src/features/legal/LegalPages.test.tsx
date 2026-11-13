import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicLayout } from '../../components/layouts'
import {
  OperatorRequestFormPage,
  ParentRequestFormPage,
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

describe('authenticated request form routes', () => {
  it.each([
    ['parent', ParentRequestFormPage, '/parent/account'],
    ['operator', OperatorRequestFormPage, '/operator/account'],
  ])(
    'keeps the %s form fail closed and links back to its account page',
    (_, Page, accountPath) => {
      render(
        <MemoryRouter>
          <Page />
        </MemoryRouter>,
      )

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'Kişisel veri başvurusu',
        }),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Başvuru konusu')).toBeDisabled()
      expect(screen.getByLabelText('Başvurunuzu açıklayın')).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Başvuruyu gönder' }),
      ).toBeDisabled()
      expect(
        screen.getByRole('link', { name: 'Hesap ve gizlilik sayfasına dön' }),
      ).toHaveAttribute('href', accountPath)
    },
  )
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
  it('exposes every footer destination in labelled groups with active state', () => {
    render(
      <MemoryRouter initialEntries={['/demands']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="demands" element={<h1>Talep panosu</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const footerNav = screen.getByRole('navigation', {
      name: 'Alt menü',
      hidden: true,
    })
    const groups = within(footerNav).getAllByRole('list', { hidden: true })
    expect(
      groups.map((group) => [
        group.getAttribute('aria-labelledby') &&
          document.getElementById(group.getAttribute('aria-labelledby')!)
            ?.textContent,
        within(group)
          .getAllByRole('link', { hidden: true })
          .map((link) => [link.textContent, link.getAttribute('href')]),
      ]),
    ).toEqual([
      [
        'Keşfet',
        [
          ['Ana sayfa', '/'],
          ['Talep panosu', '/demands'],
        ],
      ],
      [
        'Hesap',
        [
          ['Veli kaydı', '/parent/register'],
          ['İşletmeci kaydı', '/operator/register'],
        ],
      ],
      [
        'Yasal',
        [
          ['Gizlilik ve kişisel veriler', '/privacy/notice'],
          ['Kullanım koşulları', '/terms'],
          ['Kişisel veri başvuru yolu', '/privacy/requests'],
        ],
      ],
    ])
    expect(
      within(footerNav).getByRole('link', {
        name: 'Talep panosu',
        hidden: true,
      }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      within(footerNav).getByRole('link', { name: 'Ana sayfa', hidden: true }),
    ).not.toHaveAttribute('aria-current')
  })
})
