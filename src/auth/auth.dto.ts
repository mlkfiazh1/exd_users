import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsStrongPassword } from 'class-validator';

export class SignupDto {
  @ApiProperty({
    type: String,
    example: 'testuser',
    required: true,
  })
  @IsNotEmpty()
  readonly name: string;

  @ApiProperty({
    type: String,
    example: 'testuser@gmail.com',
    required: true,
  })
  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @ApiProperty({
    type: String,
    example: 'testuser@123',
    required: true,
  })
  @IsNotEmpty()
  @IsStrongPassword()
  password: string;
}

export class SigninDto {
  @ApiProperty({
    type: String,
    example: 'testuser@gmail.com',
    required: true,
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    type: String,
    example: 'testuser@123',
    required: true,
  })
  @IsNotEmpty()
  @IsStrongPassword()
  password: string;
}

export class MeDto {
  id: string;
}
