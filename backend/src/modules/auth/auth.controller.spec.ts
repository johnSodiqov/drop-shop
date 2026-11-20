import { getRefreshCookieOptions } from './auth-cookie-options';

describe('refresh cookie options', () => {
  it('uses cross-site secure cookies in production', () => {
    expect(getRefreshCookieOptions('production')).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/api/v1/auth',
    });
  });

  it('keeps strict, non-secure cookies for local development', () => {
    expect(getRefreshCookieOptions('development')).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/api/v1/auth',
    });
  });
});
