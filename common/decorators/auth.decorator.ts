import { SetMetadata } from '@nestjs/common';
import { EnumRole } from '../enum';

export const Auth = (...roles: EnumRole[]) => SetMetadata('role', roles);
