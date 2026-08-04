import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.ip ?? request.socket.remoteAddress ?? '';
  },
);
