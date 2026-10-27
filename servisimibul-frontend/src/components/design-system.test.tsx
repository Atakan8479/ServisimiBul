import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Button,
  FormField,
  SectionShell,
  StatePanel,
  StatusBadge,
} from './design-system'

describe('shared design-system primitives', () => {
  it('keeps headings, controls, and field labels semantic', () => {
    render(
      <SectionShell title="Hizmet alanı" description="Okul ve mahalle seçin.">
        <StatusBadge tone="success">Hazır</StatusBadge>
        <FormField htmlFor="school" label="Okul" hint="Bir okul seçin.">
          <select id="school" defaultValue="">
            <option value="">Seçin</option>
          </select>
        </FormField>
        <Button type="button">Kaydet</Button>
      </SectionShell>,
    )

    expect(
      screen.getByRole('heading', { name: 'Hizmet alanı' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Okul')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeEnabled()
    expect(screen.getByText('Hazır')).toBeInTheDocument()
  })

  it('announces error and loading states with appropriate live regions', () => {
    const { rerender } = render(
      <StatePanel
        tone="error"
        title="İçerik yüklenemedi"
        detail="Lütfen tekrar deneyin."
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('İçerik yüklenemedi')

    rerender(
      <StatePanel
        tone="loading"
        title="Yükleniyor"
        detail="İçerik hazırlanıyor."
      />,
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('combines existing descriptions with hints without duplicate ids', () => {
    render(
      <>
        <p id="existing-description">Mevcut açıklama</p>
        <FormField htmlFor="phone" label="Telefon" hint="Başında sıfır olsun.">
          <input
            id="contact-phone"
            aria-describedby="existing-description existing-description"
          />
        </FormField>
      </>,
    )

    const input = screen.getByLabelText('Telefon')
    expect(input).toHaveAttribute('id', 'contact-phone')
    expect(input).toHaveAttribute(
      'aria-describedby',
      'existing-description phone-hint',
    )
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('appends errors and overrides an existing valid state', () => {
    render(
      <>
        <p id="requirements">En az on karakter.</p>
        <FormField htmlFor="password" label="Şifre" error="Şifre çok kısa.">
          <input
            aria-describedby="requirements password-error"
            aria-invalid={false}
          />
        </FormField>
      </>,
    )

    const input = screen.getByLabelText('Şifre')
    expect(input).toHaveAttribute(
      'aria-describedby',
      'requirements password-error',
    )
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Şifre çok kısa.')).toHaveAttribute(
      'id',
      'password-error',
    )
  })
})
