import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { resetCsrfToken } from '../../api/client'
import { routes } from '../../app/router'
import { server } from '../../test/server'

afterEach(resetCsrfToken)

describe('operator authentication screens', () => {
  it('registers an operator without an optional business name', async () => {
    let requestBody: unknown
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/register', async ({ request }) => {
        requestBody = await request.json()
        return new HttpResponse(null, { status: 202 })
      }),
    )

    renderRoute('/operator/register')

    fireEvent.change(screen.getByLabelText('E-posta'), {
      target: { value: 'operator@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'long password value' },
    })
    fireEvent.change(screen.getByLabelText('Herkese açık iletişim telefonu'), {
      target: { value: '0532 123 45 67' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))

    expect(
      await screen.findByRole('heading', { name: 'E-postanızı kontrol edin' }),
    ).toBeInTheDocument()
    expect(requestBody).toEqual({
      email: 'operator@example.com',
      password: 'long password value',
      businessName: '',
      contactPhone: '0532 123 45 67',
    })
  })

  it('verifies the token supplied by the email link', async () => {
    let token: unknown
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/verify-email', async ({ request }) => {
        token = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    renderRoute('/operator/verify-email?token=email-token')
    fireEvent.click(screen.getByRole('button', { name: 'E-postayı doğrula' }))

    expect(
      await screen.findByText(
        'E-posta adresiniz doğrulandı. Artık güvenli şekilde giriş yapabilirsiniz.',
      ),
    ).toBeInTheDocument()
    expect(token).toEqual({ token: 'email-token' })
  })

  it('logs in with remember me and enters the operator workspace', async () => {
    let loginBody: unknown
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/login', async ({ request }) => {
        loginBody = await request.json()
        return HttpResponse.json(operatorUser)
      }),
      http.get('/api/v1/auth/me', () => HttpResponse.json(operatorUser)),
    )

    renderRoute('/operator/login')
    fireEvent.change(screen.getByLabelText('E-posta'), {
      target: { value: 'operator@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'long password value' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /Beni hatırla/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))

    expect(
      await screen.findByRole('heading', { name: 'İşletmeci alanı' }),
    ).toBeInTheDocument()
    expect(loginBody).toEqual({
      email: 'operator@example.com',
      password: 'long password value',
      rememberMe: true,
    })
  })

  it('shows server field errors next to the matching registration input', async () => {
    server.use(
      csrfHandler(),
      http.post('/api/v1/auth/register', () =>
        HttpResponse.json(
          {
            title: 'Bad Request',
            status: 400,
            detail: 'Request validation failed',
            code: 'validation_error',
            fieldErrors: { contactPhone: 'must be a valid E.164 phone' },
          },
          { status: 400 },
        ),
      ),
    )

    renderRoute('/operator/register')
    fireEvent.change(screen.getByLabelText('E-posta'), {
      target: { value: 'operator@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Şifre'), {
      target: { value: 'long password value' },
    })
    fireEvent.change(screen.getByLabelText('İşletme adı (isteğe bağlı)'), {
      target: { value: 'Pilot Servis' },
    })
    fireEvent.change(screen.getByLabelText('Herkese açık iletişim telefonu'), {
      target: { value: '12345' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))

    await waitFor(() =>
      expect(
        screen.getByLabelText('Herkese açık iletişim telefonu'),
      ).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(screen.getByText('must be a valid E.164 phone')).toBeInTheDocument()
  })
})

const operatorUser = {
  id: '6e2973ac-0302-49a8-b519-563ec9861272',
  email: 'operator@example.com',
  role: 'OPERATOR',
}

function csrfHandler() {
  return http.get('/api/v1/auth/csrf', () =>
    HttpResponse.json({
      headerName: 'X-CSRF-TOKEN',
      parameterName: '_csrf',
      token: 'csrf-token',
    }),
  )
}

function renderRoute(path: string) {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
  )
}
