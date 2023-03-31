import { Injectable, Logger } from '@nestjs/common';
import { StringDecoder } from 'string_decoder';
import * as mq from 'ibmmq';
import { MQC } from 'ibmmq';

@Injectable()
export class MqService {
  private readonly logger = new Logger(MqService.name);

  private qMgr = 'QM1';
  private qName = 'DEV.QUEUE.1';
  private msgId: string | null = null;
  private connectionHandle: mq.MQQueueManager;
  private queueHandle: mq.MQObject;
  private ok = true;
  private exitCode = 0;
  private readonly waitInterval = 3;
  private readonly decoder = new StringDecoder('utf8');

  private ghObj: mq.MQObject;
  private ghConn: mq.MQQueueManager;

  private formatErr(err: Error) {
    return 'MQ call failed in ' + err.message;
  }

  private hexToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let c = 0; c < hex.length; c += 2)
      bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
  }
  private getMessages() {
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
      console.log('Setting Match Option for MsgId');
      gmo.MatchOptions = MQC.MQMO_MATCH_MSG_ID;
      md.MsgId = Buffer.from(this.hexToBytes(this.msgId));
    }

    mq.setTuningParameters({ getLoopPollTimeMs: 500 });
    mq.Get(this.queueHandle, md, gmo, this.getCB.bind(this));
  }

  private getCB(err, hObj, gmo, md, buf, hconn) {
    if (err) {
      if (err.mqrc == MQC.MQRC_NO_MSG_AVAILABLE) {
        console.log('No more messages available.');
      } else {
        console.log(this.formatErr(err));
        this.exitCode = 1;
      }
      this.ok = false;
      mq.GetDone(hObj);
    } else {
      if (md!.Format == 'MQSTR') {
        console.log('message <%s>', this.decoder.write(buf!));
      } else {
        console.log('binary message: ' + buf!.toString());
      }
    }
  }
  async start() {
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
    mq.Conn(this.qMgr, (err, conn) => {
      if (err) {
        console.log(this.formatErr(err));
        this.exitCode = 1;
        return;
      }

      console.log('MQCONN to', this.qMgr, 'successful');

      this.connectionHandle = conn;

      const od = new mq.MQOD();
      od.ObjectName = this.qName;
      od.ObjectType = MQC.MQOT_Q;

      const openOptions = MQC.MQOO_INPUT_AS_Q_DEF + MQC.MQOO_FAIL_IF_QUIESCING;

      mq.Open(this.connectionHandle, od, openOptions, (err, obj) => {
        if (err) {
          console.log(this.formatErr(err));
          this.ok = false;
          this.exitCode = 1;
          return;
        }

        console.log('MQOPEN of', this.qName, 'successful');

        this.queueHandle = obj;

        console.log('Waiting for messages...');
        this.getMessages();
      });
    });
  }

  async stop() {
    if (this.ok) {
      console.log('Disconnecting from queue manager', this.qMgr);
      this.cleanup(this.connectionHandle, this.queueHandle);
    }

    return this.exitCode;
  }

  private cleanup(hConn: mq.MQQueueManager, hObj: mq.MQObject) {
    mq.Close(hObj, 0, (closeErr) => {
      if (closeErr) {
        console.log(this.formatErr(closeErr));
      } else {
        console.log('MQCLOSE successful');
      }
      mq.Disc(hConn, (discErr) => {
        if (discErr) {
          console.log(this.formatErr(discErr));
        } else {
          console.log('MQDISC successful');
        }
      });
    });
  }
  async putMessage() {
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

    mq.ConnxPromise(this.qMgr, cno)
      .then((hConn) => {
        this.logger.log('MQCONN to %s successful ', this.qMgr);
        this.ghConn = hConn;
        const od = new mq.MQOD();
        od.ObjectName = this.qName;
        od.ObjectType = MQC.MQOT_Q;
        const openOptions = MQC.MQOO_OUTPUT;
        return mq.OpenPromise(hConn, od, openOptions);
      })
      .then((hObj) => {
        this.logger.log('MQOPEN of %s successful', this.qName);
        const msg = 'Hello from Nest.js at ' + new Date().toString();

        const mqmd = new mq.MQMD();
        const pmo = new mq.MQPMO();
        pmo.Options =
          MQC.MQPMO_NO_SYNCPOINT |
          MQC.MQPMO_NEW_MSG_ID |
          MQC.MQPMO_NEW_CORREL_ID;

        this.ghObj = hObj;
        return mq.PutPromise(hObj, mqmd, pmo, msg);
      })
      .then(() => {
        this.logger.log('MQPUT successful');
        return mq.ClosePromise(this.ghObj, 0);
      })
      .then(() => {
        this.logger.log('MQCLOSE successful');
        return mq.DiscPromise(this.ghConn);
      })
      .then(() => {
        this.logger.log('Done.');
      })
      .catch((err: Error) => {
        this.logger.error(this.formatErr(err));
        this.cleanup(this.ghConn, this.ghObj);
      });
  }
}
