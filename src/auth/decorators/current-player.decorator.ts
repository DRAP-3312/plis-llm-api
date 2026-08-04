import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedPlayer } from '../auth.types';

export const CurrentPlayer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPlayer => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedPlayer;
  },
);
