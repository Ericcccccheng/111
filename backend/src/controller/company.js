const path = require('path');
const fs = require('fs');
const { Company } = require('../lib/db');

module.exports = class extends think.Controller {
  async indexAction() {
  try {
    const page  = Math.max(parseInt(this.get('page')  || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(this.get('limit') || '20', 10), 1), 100);
    const skip  = (page - 1) * limit;

    const [ total, list ] = await Promise.all([
      Company.countDocuments({}),
      Company.find({}, { name:1, address:1, details:1, lat:1, lng:1 })
             .sort({ updatedAt: -1 })
             .skip(skip).limit(limit).lean()
    ]);

    return this.json({ ok: true, data: list, total, page, pageSize: limit });
  } catch (e) {
    this.ctx.status = 500;
    return this.json({ ok:false, msg:'db error', error:String(e) });
  }
}

  async bboxAction() {
    try {
      const { minLat, minLng, maxLat, maxLng } = this.get();
      const a = [minLat, minLng, maxLat, maxLng].map(v => parseFloat(v));
      if (a.some(x => Number.isNaN(x))) {
        this.ctx.status = 400;
        return this.json({ ok:false, msg:'invalid bbox' });
      }
      const box = [[a[1], a[0]],[a[3], a[2]]]; // [ [lng,lat], [lng,lat] ]
      const list = await Company.find(
        { location: { $geoWithin: { $box: box } } },
        { name:1, address:1, details:1, lat:1, lng:1 }
      ).lean();
      return this.json({ ok:true, data:list });
    } catch (e) {
      this.ctx.status = 500;
      return this.json({ ok:false, msg:'bbox error', error:String(e) });
    }
  }

  async suburbAction() {
    try {
      const key = this.get('key');
      if (!key) { this.ctx.status = 400; return this.json({ ok:false, msg:'key required' }); }

      // 到后端本地找 geojson：backend/src/geo/suburbs/{key}.geojson
      const p = path.join(think.ROOT_PATH, 'src/geo/suburbs', `${key}.geojson`);
      if (!fs.existsSync(p)) {
        // ★ 没有本地文件时，直接返回空数组，而不是 404，避免前端报错
        return this.json({ ok:true, data:[] });
      }

      const feat = JSON.parse(fs.readFileSync(p, 'utf-8'));
      const geom = feat.geometry || feat;
      if (!geom || !['Polygon','MultiPolygon'].includes(geom.type)) {
        return this.json({ ok:true, data:[] });
      }

      const list = await Company.find(
        { location: { $geoWithin: { $geometry: geom } } },
        { name:1, address:1, details:1, lat:1, lng:1 }
      ).lean();
      return this.json({ ok:true, data:list });
    } catch (e) {
      this.ctx.status = 500;
      return this.json({ ok:false, msg:'suburb error', error:String(e) });
    }
  }
};
