import { BadRequestException, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UsersRepository } from '../database/repositories/user.repository';
import { MeDto, SigninDto, SignupDto } from './auth.dto';
import { In } from 'typeorm';
import { EnumStatus } from '../../common/enum';
import { ISigntoken } from './auth.interface';
import Crypterjs from 'crypterjs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async signup(payload: SignupDto) {
    const user = await this.usersRepository.findOne({
      where: {
        email: payload.email,
        status: In([EnumStatus.ACTIVE, EnumStatus.INACTIVE]),
      },
    });

    if (user) {
      throw new BadRequestException('User Already Exist');
    }

    payload.password = await bcrypt.hash(payload.password, 12);
    await this.usersRepository.create({
      ...payload,
    });

    return;
  }

  async signin(payload: SigninDto) {
    try {
      const user = await this.usersRepository.findOne({
        where: {
          email: payload.email,
          status: In([EnumStatus.ACTIVE, EnumStatus.INACTIVE]),
        },
      });

      if (!user) {
        throw new BadRequestException('Invalid Credentials u');
      }

      const isPasswordValid = await bcrypt.compare(
        payload.password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new BadRequestException('Invalid Credentials p');
      }

      const { access_token, expires_at } = this.signToken({
        id: user.id,
      });

      return {
        access_token: access_token,
        expiry_time: expires_at,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };
    } catch (e) {
      console.log(e);
    }
  }

  async me(payload: MeDto) {
    try {
      const user = await this.usersRepository.findOne({
        where: {
          id: payload.id,
          status: In([EnumStatus.ACTIVE, EnumStatus.INACTIVE]),
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    } catch (e) {
      console.log(e);
    }
  }

  private signToken(payload: ISigntoken) {
    const { id } = payload;
    const access_token_expiration_time = process.env.EXPIRATION_TIME as string;

    const expires_at = new Date(
      Date.now() + parseInt(access_token_expiration_time),
    );

    const secret = process.env.TOKEN_SECRET as string;

    let token = jwt.sign({ id }, secret, {
      expiresIn: access_token_expiration_time,
    });

    const crypter = new Crypterjs(secret);
    token = crypter.encrypt(token);

    return { access_token: token, expires_at };
  }
}
