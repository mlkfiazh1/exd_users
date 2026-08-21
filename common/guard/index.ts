import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EnumRole } from '../enum';
import Crypterjs from 'crypterjs';
import * as jwt from 'jsonwebtoken';
import { ISigntoken } from '../../src/auth/auth.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const req = context.switchToHttp().getRequest();
      const roles = this.reflector.get<number[]>('role', context.getHandler());

      // 1) Bearer token from Authorization header
      let token = '';
      if (req.headers?.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }

      // 2) GUEST + no token
      if (!token && roles.includes(EnumRole.GUEST)) {
        return true;
      }

      if (!token) {
        throw new BadRequestException('Access Token not provided');
      }

      // 3) Decrypt (Crypterjs) → jwt.verify → ISigntoken
      const secret = process.env.TOKEN_SECRET as string;
      const crypterjs = new Crypterjs(secret);
      const jwtToken = crypterjs.decrypt(token);
      const decoded = jwt.verify(jwtToken, secret) as ISigntoken;

      // 5) req.user = decoded; return true
      req.user = decoded;

      return true;
    } catch (error) {
      // console.log('error', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Internal server error');
    }
  }
}
