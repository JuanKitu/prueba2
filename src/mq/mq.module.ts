import { Module } from '@nestjs/common';
import { MqController } from './mq.controller';
import { MqService } from './mq.service';

@Module({
  controllers: [MqController],
  providers: [MqService],
})
export class MqModule {}
