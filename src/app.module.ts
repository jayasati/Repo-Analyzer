import { Module } from '@nestjs/common';
import { InputModule } from './input/input.module';

@Module({
  imports: [InputModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
