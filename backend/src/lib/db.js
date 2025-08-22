require('dotenv').config();
const mongoose = require('mongoose');
const EventEmitter = require('events');

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'my_app_db';

mongoose.set('strictQuery', true);
mongoose.connect(uri, { dbName })
  .then(() => console.log('[MongoDB] connected to', dbName))
  .catch(err => console.error('[MongoDB] connection error:', err));

/**
 * 关键点：
 * - lat/lng 用 Number（浮点），默认 null（不要用 ''）
 * - location 为 GeoJSON: { type:'Point', coordinates:[lng,lat] }，用于地理查询（可选但强烈建议）
 * - name+address 唯一索引，避免重复
 */
const CompanySchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  details: { type: String, default: '' },

  lat: { type: Number, default: null, min: -90,  max: 90 },
  lng: { type: Number, default: null, min: -180, max: 180 },

  location: {
    type: { type: String, enum: ['Point'], default: undefined },
    coordinates: { type: [Number], default: undefined } // [lng, lat]
  }
}, { timestamps: true });

CompanySchema.index({ name: 1, address: 1 }, { unique: true });
CompanySchema.index({ location: '2dsphere' });

// 保存或更新时自动同步 location
function syncLocation(docOrUpdate) {
  const lat = docOrUpdate.lat;
  const lng = docOrUpdate.lng;
  if (typeof lat === 'number' && Number.isFinite(lat) &&
      typeof lng === 'number' && Number.isFinite(lng)) {
    docOrUpdate.location = { type: 'Point', coordinates: [lng, lat] };
  } else {
    docOrUpdate.location = undefined;
  }
}
CompanySchema.pre('save', function(next) { syncLocation(this); next(); });
CompanySchema.pre('findOneAndUpdate', function(next) {
  const u = this.getUpdate() || {};
  const toSet = Object.assign({}, u.$set || u);
  syncLocation(toSet);
  this.setUpdate({ ...u, $set: { ...(u.$set||{}), ...toSet } });
  next();
});

const Company = mongoose.model('Company', CompanySchema);

// —— 变更流 + 事件总线（给 SSE 用）——
const bus = new EventEmitter();
bus.setMaxListeners(0);
let started = false;
function startChangeStream() {
  if (started) return;
  started = true;
  const cs = Company.watch([], { fullDocument: 'updateLookup' });
  cs.on('change', (change) => bus.emit('companyChange', change));
  cs.on('error', (err) => { console.error('[ChangeStream] error:', err); started = false; setTimeout(startChangeStream, 3000); });
}
startChangeStream();

module.exports = { mongoose, Company, bus };
