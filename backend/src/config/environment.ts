export const PRODUCTION_FRONTEND_URL = 'https://drop-shop-frontend-beta.vercel.app';

export function getDefaultFrontendUrl(nodeEnv: unknown): string {
  return nodeEnv === 'production' ? PRODUCTION_FRONTEND_URL : 'http://localhost:5173';
}

export function getAllowedFrontendOrigins(frontendUrl: string): string[] {
  return [...new Set([frontendUrl, PRODUCTION_FRONTEND_URL])];
}

export function validateEnvironment(values: Record<string, unknown>): Record<string, unknown> {
  const access = values.JWT_ACCESS_SECRET;
  const refresh = values.JWT_REFRESH_SECRET;
  if (typeof access !== 'string' || access.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
  }
  if (typeof refresh !== 'string' || refresh.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must contain at least 32 characters');
  }
  if (access === refresh) throw new Error('JWT access and refresh secrets must be different');

  const databaseUrl = values.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || !databaseUrl.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }
  const frontendUrl = values.FRONTEND_URL ?? getDefaultFrontendUrl(values.NODE_ENV);
  if (typeof frontendUrl !== 'string') throw new Error('FRONTEND_URL must be a URL');
  try {
    const parsedUrl = new URL(frontendUrl);
    if (values.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
      throw new Error('FRONTEND_URL must use HTTPS in production');
    }
  } catch {
    throw new Error('FRONTEND_URL must be a valid URL');
  }
  return values;
}
