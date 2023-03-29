import { Controller, Get } from '@nestjs/common';
import { MqService } from './mq.service';

@Controller('mq')
export class MqController {
  constructor(private readonly mqService: MqService) {}

  @Get('put-message')
  async putMessage() {
    await this.mqService.putMessage();
  }
}