import { Injectable, Logger } from '@nestjs/common';
import * as mq from 'ibmmq';
import { MQC } from 'ibmmq';

@Injectable()
export class MqService {
  private readonly logger = new Logger(MqService.name);

  private qMgr = 'cc0e3f504680';
  private qName = 'DEV.ADMIN.SVRCON';

  private ghObj: mq.MQObject;
  private ghConn: mq.MQQueueManager;

  private formatErr(err: Error) {
    return 'MQ call failed in ' + err.message;
  }

  private cleanup(hConn: mq.MQQueueManager, hObj: mq.MQObject) {
    mq.Close(hObj, 0, (closeErr) => {
      if (closeErr) {
        this.logger.error('Cleanup: ' + this.formatErr(closeErr));
      } else {
        this.logger.log('MQCLOSE successful');
      }
      mq.Disc(hConn, (discErr) => {
        if (discErr) {
          this.logger.error('Cleanup: ' + this.formatErr(discErr));
        } else {
          this.logger.log('MQDISC successful');
        }
      });
    });
  }

  async putMessage() {
    const cno = new mq.MQCNO();
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
