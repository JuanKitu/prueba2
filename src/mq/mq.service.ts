import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { StringDecoder } from 'string_decoder';
import * as mq from 'ibmmq';
import { MQC } from 'ibmmq';

@Injectable()
export class MqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqService.name);

  private qMgr = 'QM1';
  private qName = 'DEV.QUEUE.1';
  private readonly waitInterval = 1;
  private msgId: string | null = null;
  private connectionHandle: mq.MQQueueManager;
  private queueHandle: mq.MQObject;
  private ok = true;
  private exitCode = 0;
  private readonly decoder: StringDecoder = new StringDecoder('utf8');
  private formatErr(err: Error): string {
    return 'MQ call failed in ' + err.message;
  }
  private async delay(delayMs): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private hexToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let c = 0; c < hex.length; c += 2)
      bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
  }
  async getMessages(): Promise<string[]> {
    try {
      const md = new mq.MQMD();
      const gmo = new mq.MQGMO();

      gmo.Options =
        MQC.MQGMO_NO_SYNCPOINT |
        MQC.MQGMO_WAIT |
        MQC.MQGMO_CONVERT |
        MQC.MQGMO_FAIL_IF_QUIESCING;
      gmo.MatchOptions = MQC.MQMO_NONE;
      gmo.WaitInterval = this.waitInterval * 1000; // 3 seconds

      if (this.msgId != null) {
        gmo.MatchOptions = MQC.MQMO_MATCH_MSG_ID;
        md.MsgId = Buffer.from(this.hexToBytes(this.msgId));
      }
      mq.setTuningParameters({ getLoopPollTimeMs: 500 });
      const messages: string[] = await this.getArrayMessages(
        this.queueHandle,
        md,
        gmo,
      );
      return messages.filter((message: string) => message);
    } catch (err) {
      console.log(err);
      return err;
    }
  }
  private getArrayMessages(
    queueHandle: mq.MQObject,
    md: mq.MQMD,
    gmo: mq.MQGMO,
  ): Promise<string[]> {
    const messages: string[] = [];
    return new Promise(async (resolve, reject) => {
      mq.Get(queueHandle, md, gmo, (err, hObj, gmo, md, buf, hconn) => {
        const message = this.getCB(err, hObj, gmo, md, buf, hconn);
        messages.push(message);
      });
      await this.delay((this.waitInterval + 2) * 1000);
      resolve(messages);
    });
  }
  private getCB(
    err: mq.MQError | null,
    hObj: mq.MQObject,
    gmo: mq.MQGMO,
    md: mq.MQMD,
    buf: Buffer | null,
    hconn: mq.MQQueueManager,
  ): string {
    let message: string;
    if (err) {
      if (err.mqrc == MQC.MQRC_NO_MSG_AVAILABLE) {
      } else {
        console.log(this.formatErr(err));
        this.exitCode = 1;
      }
      this.ok = false;
      mq.GetDone(hObj);
    } else {
      if (md!.Format == 'MQSTR') {
        message = this.decoder.write(buf!);
      } else {
        message = buf!.toString();
      }
    }
    return message;
  }
  private async start(): Promise<void> {
    const myArgs = process.argv.slice(2); // Remove redundant parms
    if (myArgs[0]) {
      this.qName = myArgs[0];
    }
    if (myArgs[1]) {
      this.msgId = myArgs[1];
    }

    console.log(
      'Connecting to queue manager',
      this.qMgr,
      'and opening queue',
      this.qName,
    );
    const cno = new mq.MQCNO();
    const csp = new mq.MQCSP();
    const cd = new mq.MQCD();
    csp.UserId = 'admin';
    csp.Password = 'passw0rd';
    cno.SecurityParms = csp;
    cno.ApplName = 'prueba';
    cd.ConnectionName = 'localhost(1414)';
    cd.ChannelName = 'DEV.ADMIN.SVRCONN';
    cno.ClientConn = cd;
    cno.Options = MQC.MQCNO_NONE;
    try {
      const conn = await mq.ConnxPromise(this.qMgr, cno);
      const od = new mq.MQOD();
      od.ObjectName = this.qName;
      od.ObjectType = MQC.MQOT_Q;
      const openOptions =
        MQC.MQOO_INPUT_AS_Q_DEF + MQC.MQOO_FAIL_IF_QUIESCING + MQC.MQOO_OUTPUT;
      this.connectionHandle = conn;
      console.log('MQCONN to', this.qMgr, 'successful');
      const obj = await mq.OpenPromise(this.connectionHandle, od, openOptions);
      console.log('MQOPEN of', this.qName, 'successful');
      this.queueHandle = obj;
    } catch (err) {
      this.ok = false;
      this.exitCode = 1;
      return;
    }
  }

  private async stop(): Promise<number> {
    if (this.ok) {
      console.log('Disconnecting from queue manager', this.qMgr);
      await this.cleanup(this.connectionHandle, this.queueHandle);
    }

    return this.exitCode;
  }

  private async cleanup(
    hConn: mq.MQQueueManager,
    hObj: mq.MQObject,
  ): Promise<void> {
    try {
      await mq.ClosePromise(hObj, 0);
      console.log('MQCLOSE successful');
      await mq.DiscPromise(hConn);
      console.log('MQDISC successful');
    } catch (closeErr) {
      console.log(this.formatErr(closeErr));
    }
  }
  async putMessage(message: string): Promise<void> {
    const msg = `${message} ${new Date().toString()}`;
    const mqmd = new mq.MQMD();
    const pmo = new mq.MQPMO();
    pmo.Options =
      MQC.MQPMO_NO_SYNCPOINT | MQC.MQPMO_NEW_MSG_ID | MQC.MQPMO_NEW_CORREL_ID;
    return mq.PutPromise(this.queueHandle, mqmd, pmo, msg);
  }
  async onModuleInit() {
    await this.start();
  }
  async onModuleDestroy() {
    await this.stop();
  }
}
