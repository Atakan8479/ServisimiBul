import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceShell } from './WorkspaceShell'

function renderShell(onSignOut = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route
          element={
            <WorkspaceShell
              accountLabel="İşletmeci alanı"
              email="operator@example.com"
              loggingOut={false}
              navigation={<a href="/workspace/profile">Profil</a>}
              onSignOut={onSignOut}
            />
          }
        >
          <Route path="workspace" element={<h1>Genel bakış</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  return onSignOut
}

describe('WorkspaceShell', () => {
  it('exposes the shared workspace structure and account actions', () => {
    const onSignOut = renderShell()

    expect(screen.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
    expect(
      screen.getByRole('navigation', { name: 'İşletmeci alanı menüsü' }),
    ).toBeVisible()
    expect(screen.getByText('operator@example.com')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Çıkış yap' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('opens and dismisses the responsive navigation with the keyboard', () => {
    renderShell()
    const toggle = screen.getByRole('button', { name: 'Menü' })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getAllByRole('button', { name: 'Menüyü kapat' }),
    ).toHaveLength(2)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
