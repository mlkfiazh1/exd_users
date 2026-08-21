import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MeDto, SigninDto, SignupDto } from './auth.dto';
import { AuthService } from './auth.service';
import { User } from '../../common/decorators/user.decorator';
import { Auth } from '../../common/decorators/auth.decorator';
import { EnumRole } from '../../common/enum';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Auth(EnumRole.GUEST)
  @Post('/v1/sign-up')
  async signup(@Body() payload: SignupDto) {
    await this.authService.signup(payload);

    return { message: 'User created successfully' };
  }

  @Auth(EnumRole.GUEST)
  @Post('/v1/sign-in')
  async signin(@Body() payload: SigninDto) {
    const response = await this.authService.signin(payload);

    return { message: 'User signed in successfully', data: response };
  }

  @Auth(EnumRole.USER)
  @ApiBearerAuth()
  @Get('/v1/me')
  async me(@User() payload: MeDto) {
    const response = await this.authService.me(payload);

    return { message: 'User signed in successfully', data: response };
  }
}
