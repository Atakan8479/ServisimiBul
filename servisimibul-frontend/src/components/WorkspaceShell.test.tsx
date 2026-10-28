import { fireEvent, render, screen, within } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceShell } from './WorkspaceShell'

function renderShell(onSignOut = vi.fn()) {
  const view = render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route
          element={
            <WorkspaceShell
              accountLabel="İşletmeci alanı"
              email="operator@example.com"
              loggingOut={false}
              navigation={<Link to="/workspace/profile">Profil</Link>}
              onSignOut={onSignOut}
            />
          }
        >
          <Route path="workspace" element={<h1>Genel bakış</h1>} />
          <Route path="workspace/profile" element={<h1>Profil</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  return { ...view, onSignOut }
}

describe('WorkspaceShell', () => {
  it('exposes the shared workspace structure and account actions', () => {
    const { onSignOut } = renderShell()

    expect(screen.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
    expect(
      screen.getByRole('navigation', { name: 'İşletmeci alanı menüsü' }),
    ).toBeVisible()
    expect(screen.getByText('operator@example.com')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Çıkış yap' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('contains focus and restores it after keyboard dismissal', () => {
    renderShell()
    const toggle = screen.getByRole('button', { name: 'Menü' })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const dialog = screen.getByRole('dialog', {
      name: 'İşletmeci alanı menüsü',
    })
    const close = screen.getByRole('button', { name: 'Menüyü kapat' })
    const signOut = screen.getByRole('button', { name: 'Çıkış yap' })
    const home = within(dialog).getByRole('link', {
      name: 'ServisimiBul ana sayfa',
    })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(close).toHaveFocus()
    expect(document.querySelector('.workspace-content')).toHaveAttribute(
      'inert',
    )

    signOut.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(home).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(signOut).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
  })

  it('restores focus after backdrop dismissal but not route selection', () => {
    const { container } = renderShell()
    const toggle = screen.getByRole('button', { name: 'Menü' })

    fireEvent.click(toggle)
    fireEvent.click(
      container.querySelector('.workspace-sidebar-backdrop') as HTMLElement,
    )
    expect(toggle).toHaveFocus()

    fireEvent.click(toggle)
    const profile = screen.getByRole('link', { name: 'Profil' })
    profile.focus()
    fireEvent.click(profile)
    expect(screen.getByRole('heading', { name: 'Profil' })).toBeVisible()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).not.toHaveFocus()
  })
})
