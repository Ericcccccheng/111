<template>
  <div class="page">
    <div class="container">
      <!-- 顶部：城市按钮（单个） -->
      <div class="filters">
        <el-button
          round
          :type="activeRegion==='sz' ? 'primary':'default'"
          @click="selectRegion('sz')"
        >Shenzhen</el-button>
      </div>

      <!-- 子区域：宝安 / 南山 / 福田 / 罗湖 -->
      <div class="subfilters">
        <el-button
          v-for="s in subregions" :key="s.key" round size="small"
          :type="activeSub?.key===s.key ? 'success':'default'"
          :loading="loadingKey===s.key"
          @click="selectSub(s)"
        >{{ s.label }}</el-button>

        <el-button
          v-if="activeSub"
          round size="small"
          @click="clearSuburb()"
        >清除子区域</el-button>
      </div>

      <div id="map" class="map"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

type RegionKey = 'sz'
type Sub = {
  key: string
  label: string
  center: [number, number]
  zoom?: number
  // 该子区域的矩形边界（南西角、东北角）
  bounds: [[number, number],[number, number]] // [[southLat, westLng], [northLat, eastLng]]
}

// —— 只保留深圳 —— //
const regions = [{ key:'sz', label:'Shenzhen' }] as const

// 深圳近似中心
const SZ_CENTER: [number,number] = [22.543096, 114.057865]

// 四个区的近似矩形（可按需要微调）
const szSubs: Sub[] = [
  {
    key:'baoan', label:'宝安区',
    center:[22.67, 113.90], zoom:12,
    bounds: [[22.53, 113.80], [22.85, 113.97]] // SW, NE
  },
  {
    key:'nanshan', label:'南山区',
    center:[22.53, 113.94], zoom:13,
    bounds: [[22.47, 113.87], [22.60, 113.99]]
  },
  {
    key:'futian', label:'福田区',
    center:[22.54, 114.05], zoom:13,
    bounds: [[22.50, 114.00], [22.58, 114.08]]
  },
  {
    key:'luohu', label:'罗湖区',
    center:[22.56, 114.13], zoom:13,
    bounds: [[22.50, 114.09], [22.61, 114.18]]
  }
]

const regionDefs: Record<RegionKey,{ center:[number,number]; zoom:number; sub:Sub[] }> = {
  sz: { center: SZ_CENTER, zoom: 12, sub: szSubs }
}

const activeRegion = ref<RegionKey>('sz')
const activeSub    = ref<Sub | null>(null)
const subregions   = computed(()=> regionDefs[activeRegion.value].sub ?? [])
const loadingKey   = ref<string|null>(null)

// —— Leaflet Map & Layers —— //
let map: L.Map | null = null
let boundaryLayer: L.Rectangle | null = null   // 这里用矩形
let markerLayer: L.LayerGroup | null = null
let marker: L.CircleMarker | null = null
let es: EventSource | null = null

// 红点只在“街道级”显示（未选子区域）
const MARKER_ZOOM = 16
let bboxTimer: number | null = null
let fetchAbort: AbortController | null = null

function initMap(){
  map = L.map('map', { center: regionDefs.sz.center, zoom: regionDefs.sz.zoom, zoomControl: true, preferCanvas: true })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, attribution:'© OpenStreetMap contributors'
  }).addTo(map!)

  // 自定义 pane：边界（低）/ 红点（高）
  map!.createPane('boundaryPane')
  map!.getPane('boundaryPane')!.style.zIndex = '350'
  map!.createPane('markerPaneTop')
  map!.getPane('markerPaneTop')!.style.zIndex = '650'

  // 红点层
  markerLayer = L.layerGroup().addTo(map!)

  // 未选子区域时：缩放/平移后按视窗 BBox 取公司
  map!.on('zoomend moveend', () => {
    if (activeSub.value) return
    if (map!.getZoom() >= MARKER_ZOOM) scheduleBBoxLoad()
    else markerLayer!.clearLayers()
  })
}

function clearOverlays(){
  if(boundaryLayer && map){ map.removeLayer(boundaryLayer); boundaryLayer = null }
  if(marker && map){ map.removeLayer(marker); marker = null }
  if(markerLayer){ markerLayer.clearLayers() }
}

function flyCenter(center:[number,number], zoom:number){
  map!.flyTo(center, zoom, { duration:0.6 })
  if (marker) { map!.removeLayer(marker); marker=null }
  marker = L.circleMarker(center,{
    pane:'markerPaneTop',
    radius:6, weight:2, color:'#2c7be5', fillColor:'#2c7be5', fillOpacity:0.85
  }).addTo(map!)
}

// —— 矩形边界（不使用 GeoJSON） —— //
function drawRect(bounds: [[number,number],[number,number]], label?: string, color = '#2c7be5'){
  // 先清理旧边界
  if (boundaryLayer && map) { map!.removeLayer(boundaryLayer); boundaryLayer = null }
  boundaryLayer = L.rectangle(bounds, {
    pane:'boundaryPane',
    color, weight:2, fillColor:color, fillOpacity:0.12, interactive:false
  }).addTo(map!)
  map!.fitBounds(boundaryLayer.getBounds(), { padding:[60,60], maxZoom:17 })

  // 居中文字（可选）
  const center = boundaryLayer.getBounds().getCenter()
  L.tooltip({ permanent:true, direction:'center', className:'suburb-label' })
    .setContent(label || '')
    .setLatLng(center)
    .addTo(map!)
}

// —— 公司红点 —— //
function companyMarker(lat:number, lng:number) {
  return L.circleMarker([lat, lng], {
    pane: 'markerPaneTop',
    radius: 7, color: '#ef4444', weight: 2,
    opacity: 1, fillColor: '#ef4444', fillOpacity: 0.9
  })
}

function drawMarkers(list: Array<{name:string; details?:string; lat:number; lng:number}>){
  if (!markerLayer) return
  markerLayer!.clearLayers()
  for (const c of list) {
    if (typeof c.lat !== 'number' || typeof c.lng !== 'number') continue
    companyMarker(c.lat, c.lng)
      .bindPopup(`<b>${escapeHtml(c.name)}</b><br>${escapeHtml(c.details || '')}`)
      .addTo(markerLayer!)
  }
}

function escapeHtml(s:string){
  return s?.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] as string)) || ''
}

// —— 视窗 BBox —— //
function currentBBox() {
  const b = map!.getBounds()
  return { minLat: b.getSouth(), minLng: b.getWest(), maxLat: b.getNorth(), maxLng: b.getEast() }
}
function scheduleBBoxLoad(){
  if (bboxTimer) window.clearTimeout(bboxTimer)
  bboxTimer = window.setTimeout(loadCompaniesInBBox, 250)
}
async function loadCompaniesInBBox(){
  if (!map || !markerLayer) return
  if (activeSub.value) return
  if (map!.getZoom() < MARKER_ZOOM) { markerLayer!.clearLayers(); return }

  const { minLat, minLng, maxLat, maxLng } = currentBBox()
  if (fetchAbort) fetchAbort.abort()
  fetchAbort = new AbortController()

  const url = `/company/bbox?minLat=${minLat}&minLng=${minLng}&maxLat=${maxLat}&maxLng=${maxLng}`
  try{
    const res = await fetch(url, { signal: fetchAbort.signal, headers:{ Accept:'application/json' } })
    if (!res.ok) { markerLayer!.clearLayers(); return }
    const j = await res.json()
    if (j?.ok) drawMarkers(j.data)
  }catch{
    /* ignore */
  }
}

// —— 交互：大区/子区域 —— //
function selectRegion(key:RegionKey){
  activeRegion.value = key
  activeSub.value = null
  clearOverlays()
  const r = regionDefs[key]
  flyCenter(r.center, Math.max(r.zoom, 12))
  if (map!.getZoom() >= MARKER_ZOOM) scheduleBBoxLoad()
}

async function selectSub(s:Sub){
  activeSub.value = s
  loadingKey.value = s.key
  clearOverlays()
  try{
    // 画矩形并居中
    drawRect(s.bounds, s.label, '#2c7be5')

    // 用矩形的 BBox 拉公司
    const [[south, west],[north, east]] = s.bounds
    const url = `/company/bbox?minLat=${south}&minLng=${west}&maxLat=${north}&maxLng=${east}`
    const r = await fetch(url, { headers:{ Accept:'application/json' } })
    const j = await r.json()
    if (j?.ok) drawMarkers(j.data); else markerLayer!.clearLayers()
  }finally{
    loadingKey.value = null
  }
}

function clearSuburb(){
  activeSub.value = null
  clearOverlays()
  // 回到阈值 + 视窗模式
  if (map!.getZoom() >= MARKER_ZOOM) scheduleBBoxLoad()
}
 
// —— 生命周期 —— //
onMounted(() => {
  initMap()
  flyCenter(regionDefs.sz.center, regionDefs.sz.zoom)

  // 可选：SSE 实时刷新
  try{
    es = new EventSource('/stream/index')
    es.onmessage = async () => {
      if (activeSub.value) {
        const [[south, west],[north, east]] = activeSub.value.bounds
        const url = `/company/bbox?minLat=${south}&minLng=${west}&maxLat=${north}&maxLng=${east}`
        const r = await fetch(url); const j = await r.json()
        if (j?.ok) drawMarkers(j.data)
      } else if (map!.getZoom() >= MARKER_ZOOM) {
        scheduleBBoxLoad()
      }
    }
  }catch{}
})

onBeforeUnmount(() => {
  if (map){ map.remove(); map=null }
  if (es){ es.close(); es=null }
  if (fetchAbort){ fetchAbort.abort(); fetchAbort=null }
  if (bboxTimer){ window.clearTimeout(bboxTimer); bboxTimer=null }
})
</script>

<style scoped>
.page{ width:100vw; min-height:100vh; display:flex; justify-content:center; background:#f5f7fa; }
.container{ width:80vw; margin:0 auto; padding:16px 0 24px; display:flex; flex-direction:column; gap:12px; }
.filters,.subfilters{ display:flex; justify-content:center; gap:8px; flex-wrap:wrap; }
.map{ width:100%; height:calc(100vh - 200px); min-height:520px; border-radius:12px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,.08); background:#fff; }

.leaflet-tooltip.suburb-label{
  background: rgba(255,255,255,.9);
  color:#111;
  border:1px solid rgba(0,0,0,.15);
  padding:4px 8px;
  border-radius:6px;
  font-weight:600;
  box-shadow:0 2px 8px rgba(0,0,0,.12);
}
</style>
