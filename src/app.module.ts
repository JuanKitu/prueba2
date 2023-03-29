import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IbmmqModule } from './ibmmq/ibmmq.module';
import { MqModule } from './mq/mq.module';

@Module({
  imports: [IbmmqModule, MqModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
