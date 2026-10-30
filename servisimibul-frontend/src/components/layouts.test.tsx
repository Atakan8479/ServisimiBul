import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { PublicLayout } from './layouts'

describe('PublicLayout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('contains mobile menu focus and restores it after dismissal', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<h1>Okulunu seç</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('button', { name: 'Menü' })
    fireEvent.click(toggle)

    const dialog = screen.getByRole('dialog', { name: 'Ana menü' })
    const navigation = screen.getByRole('navigation', { name: 'Ana menü' })
    const firstLink = within(navigation).getByRole('link', {
      name: 'Ana sayfa',
    })
    const lastLink = within(navigation).getByRole('link', {
      name: 'İşletmeci kaydı',
    })
    expect(firstLink).toHaveFocus()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.querySelector('main')).toHaveAttribute('inert')
    expect(screen.getByRole('contentinfo', { hidden: true })).toHaveAttribute(
      'inert',
    )

    firstLink.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(lastLink).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
  })
})
