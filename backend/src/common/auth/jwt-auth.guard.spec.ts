import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('returns a Nest HTTP 401 when no authenticated user is supplied', () => {
    const guard = new JwtAuthGuard();

    expect(() => guard.handleRequest(null, null, null, {} as ExecutionContext, 401))
      .toThrow(UnauthorizedException);
  });
});
