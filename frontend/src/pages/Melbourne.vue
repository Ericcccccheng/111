<template>
  <div class="page">
    <div class="container">
      <div class="filters">
        <el-button v-for="r in regions" :key="r.key" round
                   :type="activeRegion===r.key?'primary':'default'"
                   @click="selectRegion(r.key)">{{ r.label }}</el-button>
      </div>

      <div v-if="subregions.length" class="subfilters">
        <el-button v-for="s in subregions" :key="s.key" round size="small"
                   :type="activeSub?.key===s.key?'success':'default'"
                   :loading="loadingKey===s.key"
                   @click="selectSub(s)">{{ s.label }}</el-button>
      </div>

      <div id="map" class="map"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

type RegionKey = 'city'|'east'|'west'|'south'|'north'
type Sub = { key:string; label:string; center:[number,number]; zoom?:number; nominatimQ?:string }

const regions = [
  { key:'east',  label:'East' },
  { key:'south',  label:'South' },
  { key:'city',  label:'City' },
  { key:'west', label:'West' },
  { key:'north', label:'North' }
] as const

const regionDefs: Record<RegionKey,{center:[number,number]; zoom:number; sub?:Sub[]}> = {
  city: {
    center: [-37.8136,144.9631], zoom: 13,
    sub: [
      { key:'cbd',       label:'Melbourne CBD', center:[-37.8136,144.9631], zoom:17, nominatimQ:'Melbourne City Centre, VIC, Australia' },
      { key:'docklands', label:'Docklands',     center:[-37.8150,144.9470], zoom:16, nominatimQ:'Docklands, VIC, Australia' },
      { key:'southbank', label:'Southbank',     center:[-37.8249,144.9646], zoom:16, nominatimQ:'Southbank, VIC, Australia' }
    ]
  },
  east: {
    center: [-37.82,145.05], zoom: 12,
    sub: [
      { key:'richmond',   label:'Richmond',       center:[-37.8183,145.0018], zoom:16, nominatimQ:'Richmond, VIC, Australia' },
      { key:'hawthorn',   label:'Hawthorn',       center:[-37.8240,145.0350], zoom:16, nominatimQ:'Hawthorn, VIC, Australia' },
      { key:'camberwell', label:'Camberwell',     center:[-37.8420,145.0680], zoom:17, nominatimQ:'Camberwell, VIC, Australia' },
      { key:'boxhill',    label:'Box Hill',       center:[-37.8180,145.1250], zoom:17, nominatimQ:'Box Hill, VIC, Australia' },
      { key:'doncaster',  label:'Doncaster',      center:[-37.7887,145.1230], zoom:16, nominatimQ:'Doncaster, VIC, Australia' },
      { key:'glenwaverley',label:'Glen Waverley', center:[-37.8770,145.1640], zoom:17, nominatimQ:'Glen Waverley, VIC, Australia' }
    ]
  },
  west: {
    center: [-37.81,144.84], zoom: 12,
    sub: [
      { key:'footscray',  label:'Footscray',   center:[-37.8000,144.9010], zoom:16, nominatimQ:'Footscray, VIC, Australia' },
      { key:'yarraville', label:'Yarraville',  center:[-37.8160,144.8890], zoom:16, nominatimQ:'Yarraville, VIC, Australia' },
      { key:'werribee',   label:'Werribee',    center:[-37.9000,144.6570], zoom:14, nominatimQ:'Werribee, VIC, Australia' }
    ]
  },
  south: {
    center: [-37.90,145.02], zoom: 12,
    sub: [
      { key:'southyarra', label:'South Yarra', center:[-37.8380,144.9930], zoom:16, nominatimQ:'South Yarra, VIC, Australia' },
      { key:'stkilda',    label:'St Kilda',    center:[-37.8670,144.9800], zoom:16, nominatimQ:'St Kilda, VIC, Australia' },
      { key:'chadstone',  label:'Chadstone',   center:[-37.8870,145.0810], zoom:16, nominatimQ:'Chadstone, VIC, Australia' }
    ]
  },
  north: {
    center: [-37.76,144.96], zoom: 12,
    sub: [
      { key:'carlton',   label:'Carlton',     center:[-37.8000,144.9669], zoom:16, nominatimQ:'Carlton, VIC, Australia' },
      { key:'brunswick', label:'Brunswick',   center:[-37.7670,144.9620], zoom:16, nominatimQ:'Brunswick, VIC, Australia' },
      { key:'ivanhoe',   label:'Ivanhoe',     center:[-37.7670,145.0450], zoom:16, nominatimQ:'Ivanhoe, VIC, Australia' }
    ]
  }
}

const activeRegion = ref<RegionKey>('city')
const activeSub = ref<Sub|null>(null)
const subregions = computed(()=> regionDefs[activeRegion.value].sub ?? [])

let map:L.Map|null=null
let boundaryLayer:L.GeoJSON<any>|null=null
let marker:L.CircleMarker|null=null
const loadingKey = ref<string|null>(null)

function slugify(s:string){
  return s.toLowerCase().trim()
    .replace(/[&/]/g,' ')
    .replace(/[^a-z0-9\s-]/g,'')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-')
}

function initMap(){
  map = L.map('map',{ center:regionDefs.city.center, zoom:13, zoomControl:true, preferCanvas:true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, attribution:'© OpenStreetMap contributors'
  }).addTo(map!)

  map!.createPane('boundaryPane');               // 多边形边界（低）
  map!.getPane('boundaryPane')!.style.zIndex = '350';
  map!.createPane('markerPaneTop');              // 公司红点（高）
  map!.getPane('markerPaneTop')!.style.zIndex = '650';

  // ★ 公司的红点图层
  markerLayer = L.layerGroup().addTo(map!);
  // ★ 当“未选中 suburb”时：只有 zoom ≥ 阈值 才加载 BBox 内公司
  map!.on('zoomend moveend', () => {
    if (activeSub.value) return;                  // suburb 模式下不走 BBox
    if (map!.getZoom() >= MARKER_ZOOM) scheduleBBoxLoad();
    else markerLayer!.clearLayers();
  });
}
function clearOverlays(){
  if(boundaryLayer&&map){ map.removeLayer(boundaryLayer); boundaryLayer=null }
  if(marker&&map){ map.removeLayer(marker); marker=null }
}
function fitFeature(
  feature: any,
  opts?: { color?: string; fill?: string; label?: string }
){
  const baseColor = opts?.color ?? '#2c7be5'
  const fillColor = opts?.fill  ?? baseColor

  const baseStyle: L.PathOptions = {
    color: baseColor,
    weight: 3,
    opacity: 0.9,
    fillColor,
    fillOpacity: 0.15,
    lineJoin: 'round',
    lineCap: 'round',
    className: 'suburb-shape',
    pane: 'overlayPane', // 默认即可；需要更靠上可以新建 pane
    interactive: true
  }

  const hoverStyle: L.PathOptions = {
    color: baseColor,
    weight: 5,
    opacity: 1,
    fillOpacity: 0.25
  }

  //const selectStyle: L.PathOptions = {
  //  color: '#ff7a00',     // 选中时边线色
  //  weight: 5,
  //  opacity: 1,
  //  fillColor: '#ff7a00',
  //  fillOpacity: 0.15
  //}

  boundaryLayer = L.geoJSON(feature.geometry || feature, {
    pane: 'boundaryPane',
    style: baseStyle,
    onEachFeature: (_, layer) => {
      layer.on('mouseover', () => (layer as L.Path).setStyle(hoverStyle))
      layer.on('mouseout',  () => (layer as L.Path).setStyle(baseStyle))
      //layer.on('click',     () => (layer as L.Path).setStyle(selectStyle))
    }
  }).addTo(map!)

  boundaryLayer.bringToFront()
  const b = boundaryLayer.getBounds()
  map!.fitBounds(b, { padding: [60, 60], maxZoom: 17 })
}
function flyCenter(center:[number,number], zoom:number){
  map!.flyTo(center, zoom, { duration:0.6 })
  marker = L.circleMarker(center,{ radius:8, weight:2 }).addTo(map!)
}

async function fetchLocalBoundary(s:Sub){
  // 先按 key，没命中再按 label 的 slug
  const tries = [
    `/geo/suburbs/${s.key}.geojson`,
    `/geo/suburbs/${slugify(s.label)}.geojson`,
  ]
  for(const url of tries){
    try{
      const r = await fetch(url, { headers:{Accept:'application/json'} })
      if(r.ok){ return await r.json() }
    }catch(_){}
  }
  return null
}
async function fetchNominatim(s:Sub){
  const q = s.nominatimQ || `${s.label}, VIC, Australia`
  const url = `https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&limit=5&q=${encodeURIComponent(q)}`
  const r = await fetch(url,{ headers:{Accept:'application/json'} })
  if(!r.ok) throw new Error('nominatim fail')
  const data = await r.json()
  const feats = data?.features || []
  if(!feats.length) return null
  // 简单挑选：多边形优先、名字包含 label 优先
  const lower = s.label.toLowerCase()
  feats.sort((a:any,b:any)=>{
    const t=(x:any)=>String(x?.geometry?.type||'')
    const ps=(x:any)=>/polygon/i.test(t(x))?2:0
    const ns=(x:any)=>String(x?.properties?.display_name||'').toLowerCase().includes(lower)?1:0
    const cs=(x:any)=>{
      const c=x?.geometry?.coordinates
      if(!c) return 0
      if(Array.isArray(c[0][0])) return c[0].length
      if(Array.isArray(c[0])) return c.reduce((m:number,p:any)=>m+(p?.[0]?.length||0),0)
      return 0
    }
    return (ps(b)*1000+ns(b)*100+cs(b))-(ps(a)*1000+ns(a)*100+cs(a))
  })
  return feats[0]
}

function selectRegion(key:RegionKey){
  activeRegion.value = key
  activeSub.value = null
  clearOverlays()
  const r = regionDefs[key]
  flyCenter(r.center, Math.max(r.zoom,12))
  if (map!.getZoom() >= MARKER_ZOOM) scheduleBBoxLoad();
  else markerLayer!.clearLayers();
}

async function selectSub(s: Sub){
  activeSub.value = s;
  loadingKey.value = s.key;
  clearOverlays();

  try{
    // —— 先加载边界（本地优先；不命中再线上）——
    const local = await fetchLocalBoundary(s);
    if (local) {
      fitFeature(local, { label: s.label });  // 如果你有传 color，就 { color, label }
    } else {
      const online = await fetchNominatim(s);
      if (online) {
        fitFeature(online, { label: s.label });
      } else {
        // 双兜底：中心点 + 大 zoom
        flyCenter(s.center, Math.max(s.zoom ?? 16, 16));
      }
    }

    // —— 选中某个 suburb：只显示该边界内的公司 —— //
    try {
      const r = await fetch(`/company/suburb?key=${encodeURIComponent(s.key)}`, { headers:{ Accept:'application/json' } });
      const j = await r.json();
      if (j?.ok) drawMarkers(j.data);
      else markerLayer!.clearLayers();
    } catch {
      markerLayer!.clearLayers();
    }
  } finally {
    loadingKey.value = null;
  }
}


//----------------------------------------------------------
const MARKER_ZOOM = 16;                  // “街道级”的阈值；觉得还要近就改 17
let markerLayer: L.LayerGroup | null = null;
let fetchAbort: AbortController | null = null;
let bboxTimer: number | null = null;
let es: EventSource | null = null;

function companyMarker(lat:number, lng:number) {
  return L.circleMarker([lat, lng], {
    pane: 'markerPaneTop',
    radius: 7,
    color: '#ef4444',
    weight: 2,
    opacity: 1,
    fillColor: '#ef4444',
    fillOpacity: 0.9
  });
}

// 统一渲染函数
function drawMarkers(list: Array<{name:string; details?:string; lat:number; lng:number}>) {
  if (!markerLayer) return;
  markerLayer!.clearLayers();
  for (const c of list) {
    if (typeof c.lat !== 'number' || typeof c.lng !== 'number') continue;
    companyMarker(c.lat, c.lng)
      .bindPopup(`<b>${escapeHtml(c.name)}</b><br>${escapeHtml(c.details || '')}`)
      .addTo(markerLayer!);
  }
}

function escapeHtml(s:string){
  return s?.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] as string)) || '';
}

// 地图当前视窗 BBox
function currentBBox() {
  const b = map!.getBounds();
  return {
    minLat: b.getSouth(), minLng: b.getWest(),
    maxLat: b.getNorth(), maxLng: b.getEast()
  };
}

// 轻量去抖（拖动/缩放停止 250ms 后再拉数据）
function scheduleBBoxLoad() {
  if (bboxTimer) window.clearTimeout(bboxTimer);
  bboxTimer = window.setTimeout(loadCompaniesInBBox, 250);
}

// 只在 zoom≥阈值 且“未选中 suburb”时，按 BBox 拉公司
async function loadCompaniesInBBox() {
  if (!map || !markerLayer) return;
  if (activeSub.value) return;                      // suburb 模式下不走 BBox
  if (map!.getZoom() < MARKER_ZOOM) { markerLayer!.clearLayers(); return; }

  const { minLat, minLng, maxLat, maxLng } = currentBBox();
  if (fetchAbort) fetchAbort.abort();
  fetchAbort = new AbortController();

  const url = `/company/bbox?minLat=${minLat}&minLng=${minLng}&maxLat=${maxLat}&maxLng=${maxLng}`;
  try {
    const res = await fetch(url, { signal: fetchAbort.signal, headers:{ Accept:'application/json' } });
    if (!res.ok) { markerLayer!.clearLayers(); return; }
    const j = await res.json();
    if (j?.ok) drawMarkers(j.data);
  } catch {
    /* 用户在拖动/缩放时 abort 属于正常情况，忽略 */
  }
}

onMounted(()=>{ 
  initMap(); 
  flyCenter(regionDefs.city.center, regionDefs.city.zoom);
  try {
    es = new EventSource('/stream/index');
    es.onmessage = async () => {
      // 数据变化时刷新当前视图对应的数据
      if (activeSub.value) {
        const r = await fetch(`/company/suburb?key=${encodeURIComponent(activeSub.value.key)}`);
        const j = await r.json();
        if (j?.ok) drawMarkers(j.data);
      } else if (map && map.getZoom() >= MARKER_ZOOM) {
        scheduleBBoxLoad();
      }
    };
  } catch {} 
})
onBeforeUnmount(()=>{ 
  if(map){ map.remove(); map=null } 
  if (es) { es.close(); es = null; }
  if (fetchAbort) { fetchAbort.abort(); fetchAbort = null; }
  if (bboxTimer) { window.clearTimeout(bboxTimer); bboxTimer = null; }
  })
</script>

<style scoped>
.page{ width:100vw; min-height:100vh; display:flex; justify-content:center; background:#f5f7fa; }
.container{ width:80vw; margin:0 auto; padding:16px 0 24px; display:flex; flex-direction:column; gap:12px; }
.filters,.subfilters{ display:flex; justify-content:center; gap:8px; flex-wrap:wrap; }
.map{ width:100%; height:calc(100vh - 200px); min-height:520px; border-radius:12px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,.08); background:#fff; }
.suburb-label {
  background: transparent;
  border: none;
  color: #0f172a;
  font-weight: 600;
  text-shadow: 0 0 4px rgba(255,255,255,0.9);
}

/* 发光边界（依赖我们给的 className:'suburb-shape'） */
.suburb-shape {
  filter: drop-shadow(0 0 6px rgba(44,123,229,.45));
}
</style>
