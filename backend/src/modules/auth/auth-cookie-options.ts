export function getRefreshCookieOptions(nodeEnv: unknown): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict' | 'none';
  path: string;
} {
  const isProduction = nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/api/v1/auth',
  };
}
