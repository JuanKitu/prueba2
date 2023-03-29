import { Injectable } from '@nestjs/common';
import * as mq from 'ibmmq';
import { MQC } from 'ibmmq';

@Injectable()
export class IbmmqService {
  private qMgr = 'QM1';
  private qName = 'DEV.QUEUE.1';

  async sendToQueue(message: string) {
    const cno = new mq.MQCNO();
    cno.Options = MQC.MQCNO_NONE;
    const conn = await mq.ConnxPromise(this.qMgr, cno);
    const od = new mq.MQOD();
    od.ObjectName = this.qName;
    od.ObjectType = MQC.MQOT_Q;
    const openOptions = MQC.MQOO_OUTPUT;
    const hObj = await mq.OpenPromise(conn, od, openOptions);
    const mqmd = new mq.MQMD();
    const pmo = new mq.MQPMO();
    pmo.Options =
      MQC.MQPMO_NO_SYNCPOINT |
      MQC.MQPMO_NEW_MSG_ID |
      MQC.MQPMO_NEW_CORREL_ID;
    await mq.PutPromise(hObj, mqmd, pmo, message);
    await mq.ClosePromise(hObj, 0);
    await mq.DiscPromise(conn);
  }
}
