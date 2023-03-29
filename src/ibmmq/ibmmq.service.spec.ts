import { Test, TestingModule } from '@nestjs/testing';
import { IbmmqService } from './ibmmq.service';

describe('IbmmqService', () => {
  let service: IbmmqService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IbmmqService],
    }).compile();

    service = module.get<IbmmqService>(IbmmqService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
