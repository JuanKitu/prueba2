import { Test, TestingModule } from '@nestjs/testing';
import { MqController } from './mq.controller';

describe('MqController', () => {
  let controller: MqController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MqController],
    }).compile();

    controller = module.get<MqController>(MqController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
