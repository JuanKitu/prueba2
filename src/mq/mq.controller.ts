import { Controller, Get, Post, Body } from '@nestjs/common';
import { MqService } from './mq.service';

@Controller('mq')
export class MqController {
  constructor(private readonly mqService: MqService) {}

  @Post('put-message')
  async putMessage(@Body() payload) {
    await this.mqService.putMessage(payload.message);
  }
  @Get('get-message')
  async getMessage() {
    return await this.mqService.getMessages();
    //await this.mqService.stop();
  }
}
