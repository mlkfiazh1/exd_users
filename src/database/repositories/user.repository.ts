import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOneOptions, Repository, SaveOptions } from 'typeorm';
import { Users } from '../entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(Users)
    private readonly repository: Repository<Users>,
  ) {}

  async findOne(options: FindOneOptions<Users>): Promise<Users | null> {
    return this.repository.findOne(options);
  }

  async create(entity: DeepPartial<Users>): Promise<Users> {
    const response = this.repository.create(entity);
    return await this.repository.save(response);
  }

  async save(entity: Users, options?: SaveOptions): Promise<Users> {
    return this.repository.save(entity, options);
  }
}
