import {
  getAllowedFrontendOrigins,
  getDefaultFrontendUrl,
  PRODUCTION_FRONTEND_URL,
} from './environment';

describe('frontend URL configuration', () => {
  it('uses the deployed frontend as the production default', () => {
    expect(getDefaultFrontendUrl('production')).toBe(PRODUCTION_FRONTEND_URL);
  });

  it('keeps localhost for development and allows the deployed frontend origin', () => {
    const frontendUrl = getDefaultFrontendUrl('development');

    expect(frontendUrl).toBe('http://localhost:5173');
    expect(getAllowedFrontendOrigins(frontendUrl)).toEqual([
      'http://localhost:5173',
      PRODUCTION_FRONTEND_URL,
    ]);
  });

  it('preserves a configured frontend origin without duplicating production origin', () => {
    expect(getAllowedFrontendOrigins(PRODUCTION_FRONTEND_URL)).toEqual([PRODUCTION_FRONTEND_URL]);
  });
});
