const { bus, Company } = require('../lib/db');
const toClient = (doc) => { if (!doc) return null; const o = { ...doc }; if (o._id) o._id = String(o._id); return o; };


module.exports = class extends think.Controller {
  async indexAction() { // GET /api/stream
    const res = this.ctx.res, req = this.ctx.req;
    this.ctx.set('Content-Type', 'text/event-stream; charset=utf-8');
    this.ctx.set('Cache-Control', 'no-cache');
    this.ctx.set('Connection', 'keep-alive');
    res.write(': connected\n\n');

    const handler = async (change) => {
      try {
        const { operationType, documentKey, fullDocument } = change;
        let payload = { type: operationType, id: null, doc: null };
        if (documentKey && documentKey._id) payload.id = String(documentKey._id);
        if (['insert','update','replace'].includes(operationType)) {
          const doc = fullDocument || await Company.findById(payload.id).lean();
          payload.doc = toClient(doc);
        }
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) { console.error('[SSE] send error:', e); }
    };

    bus.on('companyChange', handler);
    req.on('close', () => { bus.removeListener('companyChange', handler); try { res.end(); } catch(_){} });
  }
};
