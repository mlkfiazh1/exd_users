import { Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async (moduleRef: ModuleRef) => {
        return {
          type: 'mysql',
          host: process.env.DATABASE_HOST,
          port: Number(process.env.DATABASE_PORT),
          username: process.env.DATABASE_USERNAME,
          password: process.env.DATABASE_PASSWORD,
          database: process.env.DATABASE_NAME,
          entities: [],
          synchronize: true,
          poolSize: 10,
        };
      },
      inject: [ModuleRef], // Inject ModuleRef to access providers dynamically
    }),
    TypeOrmModule.forFeature([]),
  ],
  providers: [],
  exports: [],
})
export class DatabaseModule {}
