import { Module } from '@nestjs/common';
import { IbmmqService } from './ibmmq.service';

@Module({
  providers: [IbmmqService],
  exports: [IbmmqService],
})
export class IbmmqModule {}
