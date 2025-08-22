<template>
  <div class="page">
    <div class="container">
      <!-- 顶部五大区 -->
      <div class="filters">
        <el-button
          v-for="r in regions"
          :key="r.key"
          round
          :type="activeRegion === r.key ? 'primary' : 'default'"
          @click="selectRegion(r.key)"
        >
          {{ r.label }}
        </el-button>
      </div>

      <!-- 二级小区（仅当该大区有子区时显示） -->
      <div v-if="subregions.length" class="subfilters">
        <el-button
          v-for="s in subregions"
          :key="s.key"
          round
          size="small"
          :type="activeSub?.key === s.key ? 'success' : 'default'"
          @click="selectSub(s)"
          :loading="loadingKey === s.key"
        >
          {{ s.label }}
        </el-button>
      </div>

      <!-- 地图 -->
      <div id="map" class="map"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

type RegionKey = 'city' | 'east' | 'west' | 'south' | 'north'
type Sub = {
  key: string
  label: string
  center: [number, number]
  zoom?: number
  // 用于 Nominatim 查询的字符串，尽量具体以拿到行政边界
  nominatimQ?: string
}

// 顶部五大区
const regions = [
  { key: 'city',  label: 'City' },
  { key: 'east',  label: '东边' },
  { key: 'west',  label: '西边' },
  { key: 'south', label: '南边' },
  { key: 'north', label: '北边' }
] as const

// 五大区中心点（近似）与代表性 Suburbs（商业/办公活跃）
// nominatimQ 尽量写成 “Suburb, VIC, Australia” 以提高命中率
const regionDefs: Record<RegionKey, { center: [number, number]; zoom: number; sub?: Sub[] }> = {
  city: {
    center: [-37.8136, 144.9631], zoom: 13,
    sub: [
      { key: 'cbd',       label: 'Melbourne CBD', center: [-37.8136, 144.9631], zoom: 15, nominatimQ: 'Melbourne, VIC, Australia' },
      { key: 'docklands', label: 'Docklands',     center: [-37.8150, 144.9470], zoom: 15, nominatimQ: 'Docklands, VIC, Australia' },
      { key: 'southbank', label: 'Southbank',     center: [-37.8249, 144.9646], zoom: 15, nominatimQ: 'Southbank, VIC, Australia' }
    ]
  },
  east: {
    center: [-37.82, 145.05], zoom: 12,
    sub: [
      { key: 'richmond',     label: 'Richmond',       center: [-37.8183, 145.0018], zoom: 15, nominatimQ: 'Richmond, VIC, Australia' },
      { key: 'hawthorn',     label: 'Hawthorn',       center: [-37.8240, 145.0350], zoom: 15, nominatimQ: 'Hawthorn, VIC, Australia' },
      { key: 'kew',          label: 'Kew',            center: [-37.8060, 145.0310], zoom: 15, nominatimQ: 'Kew, VIC, Australia' },
      { key: 'camberwell',   label: 'Camberwell',     center: [-37.8420, 145.0680], zoom: 16, nominatimQ: 'Camberwell, VIC, Australia' },
      { key: 'balwyn',       label: 'Balwyn',         center: [-37.8115, 145.0824], zoom: 15, nominatimQ: 'Balwyn, VIC, Australia' },
      { key: 'surreyhills',  label: 'Surrey Hills',   center: [-37.8245, 145.0940], zoom: 15, nominatimQ: 'Surrey Hills, VIC, Australia' },
      { key: 'boxhill',      label: 'Box Hill',       center: [-37.8180, 145.1250], zoom: 16, nominatimQ: 'Box Hill, VIC, Australia' },
      { key: 'blackburn',    label: 'Blackburn',      center: [-37.8190, 145.1510], zoom: 15, nominatimQ: 'Blackburn, VIC, Australia' },
      { key: 'burwood',      label: 'Burwood',        center: [-37.8500, 145.1120], zoom: 15, nominatimQ: 'Burwood, VIC, Australia' },
      { key: 'doncaster',    label: 'Doncaster',      center: [-37.7887, 145.1230], zoom: 15, nominatimQ: 'Doncaster, VIC, Australia' },
      { key: 'doncastE',     label: 'Doncaster East', center: [-37.7870, 145.1630], zoom: 15, nominatimQ: 'Doncaster East, VIC, Australia' },
      { key: 'mtwaverley',   label: 'Mount Waverley', center: [-37.8779, 145.1295], zoom: 15, nominatimQ: 'Mount Waverley, VIC, Australia' },
      { key: 'glenwaverley', label: 'Glen Waverley',  center: [-37.8770, 145.1640], zoom: 16, nominatimQ: 'Glen Waverley, VIC, Australia' },
      { key: 'ringwood',     label: 'Ringwood',       center: [-37.8160, 145.2240], zoom: 14, nominatimQ: 'Ringwood, VIC, Australia' }
    ]
  },
  west: {
    center: [-37.81, 144.84], zoom: 12,
    sub: [
      { key: 'footscray',   label: 'Footscray',    center: [-37.8000, 144.9010], zoom: 15, nominatimQ: 'Footscray, VIC, Australia' },
      { key: 'yarraville',  label: 'Yarraville',   center: [-37.8160, 144.8890], zoom: 15, nominatimQ: 'Yarraville, VIC, Australia' },
      { key: 'seddon',      label: 'Seddon',       center: [-37.8060, 144.8920], zoom: 15, nominatimQ: 'Seddon, VIC, Australia' },
      { key: 'newport',     label: 'Newport',      center: [-37.8670, 144.8840], zoom: 15, nominatimQ: 'Newport, VIC, Australia' },
      { key: 'williamstown',label: 'Williamstown', center: [-37.8650, 144.9040], zoom: 15, nominatimQ: 'Williamstown, VIC, Australia' },
      { key: 'altona',      label: 'Altona',       center: [-37.8670, 144.8290], zoom: 14, nominatimQ: 'Altona, VIC, Australia' },
      { key: 'sunshine',    label: 'Sunshine',     center: [-37.7800, 144.8320], zoom: 14, nominatimQ: 'Sunshine, VIC, Australia' },
      { key: 'braybrook',   label: 'Braybrook',    center: [-37.7900, 144.8640], zoom: 15, nominatimQ: 'Braybrook, VIC, Australia' },
      { key: 'pointcook',   label: 'Point Cook',   center: [-37.9140, 144.7440], zoom: 14, nominatimQ: 'Point Cook, VIC, Australia' },
      { key: 'werribee',    label: 'Werribee',     center: [-37.9000, 144.6570], zoom: 13, nominatimQ: 'Werribee, VIC, Australia' }
    ]
  },
  south: {
    center: [-37.90, 145.02], zoom: 12,
    sub: [
      { key: 'southyarra', label: 'South Yarra',  center: [-37.8380, 144.9930], zoom: 15, nominatimQ: 'South Yarra, VIC, Australia' },
      { key: 'prahran',    label: 'Prahran',      center: [-37.8520, 144.9930], zoom: 15, nominatimQ: 'Prahran, VIC, Australia' },
      { key: 'toorak',     label: 'Toorak',       center: [-37.8420, 145.0180], zoom: 15, nominatimQ: 'Toorak, VIC, Australia' },
      { key: 'stkilda',    label: 'St Kilda',     center: [-37.8670, 144.9800], zoom: 15, nominatimQ: 'St Kilda, VIC, Australia' },
      { key: 'elwood',     label: 'Elwood',       center: [-37.8840, 144.9840], zoom: 15, nominatimQ: 'Elwood, VIC, Australia' },
      { key: 'brighton',   label: 'Brighton',     center: [-37.9060, 144.9930], zoom: 15, nominatimQ: 'Brighton, VIC, Australia' },
      { key: 'elsternwick',label: 'Elsternwick',  center: [-37.8830, 145.0040], zoom: 15, nominatimQ: 'Elsternwick, VIC, Australia' },
      { key: 'caulfield',  label: 'Caulfield',    center: [-37.8760, 145.0220], zoom: 15, nominatimQ: 'Caulfield, VIC, Australia' },
      { key: 'bentleigh',  label: 'Bentleigh',    center: [-37.9190, 145.0350], zoom: 15, nominatimQ: 'Bentleigh, VIC, Australia' },
      { key: 'moorabbin',  label: 'Moorabbin',    center: [-37.9430, 145.0370], zoom: 15, nominatimQ: 'Moorabbin, VIC, Australia' },
      { key: 'cheltenham', label: 'Cheltenham',   center: [-37.9660, 145.0530], zoom: 14, nominatimQ: 'Cheltenham, VIC, Australia' },
      { key: 'chadstone',  label: 'Chadstone',    center: [-37.8870, 145.0810], zoom: 15, nominatimQ: 'Chadstone, VIC, Australia' },
      { key: 'carnegie',   label: 'Carnegie',     center: [-37.8870, 145.0580], zoom: 15, nominatimQ: 'Carnegie, VIC, Australia' },
      { key: 'oakleigh',   label: 'Oakleigh',     center: [-37.9000, 145.0930], zoom: 15, nominatimQ: 'Oakleigh, VIC, Australia' },
      { key: 'murrumbeena',label: 'Murrumbeena',  center: [-37.9000, 145.0710], zoom: 15, nominatimQ: 'Murrumbeena, VIC, Australia' },
      { key: 'clayton',    label: 'Clayton',      center: [-37.9240, 145.1280], zoom: 14, nominatimQ: 'Clayton, VIC, Australia' },
      { key: 'dandenong',  label: 'Dandenong',    center: [-37.9870, 145.2150], zoom: 13, nominatimQ: 'Dandenong, VIC, Australia' }
    ]
  },
  north: {
    center: [-37.76, 144.96], zoom: 12,
    sub: [
      { key: 'northmelb',  label: 'North Melbourne', center: [-37.8060, 144.9410], zoom: 15, nominatimQ: 'North Melbourne, VIC, Australia' },
      { key: 'parkville',  label: 'Parkville',       center: [-37.7840, 144.9550], zoom: 15, nominatimQ: 'Parkville, VIC, Australia' },
      { key: 'carlton',    label: 'Carlton',         center: [-37.8000, 144.9669], zoom: 15, nominatimQ: 'Carlton, VIC, Australia' },
      { key: 'fitzroy',    label: 'Fitzroy',         center: [-37.7984, 144.9780], zoom: 15, nominatimQ: 'Fitzroy, VIC, Australia' },
      { key: 'collingwood',label: 'Collingwood',     center: [-37.8006, 144.9864], zoom: 15, nominatimQ: 'Collingwood, VIC, Australia' },
      { key: 'brunswick',  label: 'Brunswick',       center: [-37.7670, 144.9620], zoom: 15, nominatimQ: 'Brunswick, VIC, Australia' },
      { key: 'coburg',     label: 'Coburg',          center: [-37.7440, 144.9640], zoom: 14, nominatimQ: 'Coburg, VIC, Australia' },
      { key: 'northcote',  label: 'Northcote',       center: [-37.7690, 144.9990], zoom: 15, nominatimQ: 'Northcote, VIC, Australia' },
      { key: 'thornbury',  label: 'Thornbury',       center: [-37.7570, 145.0060], zoom: 15, nominatimQ: 'Thornbury, VIC, Australia' },
      { key: 'preston',    label: 'Preston',         center: [-37.7410, 145.0050], zoom: 14, nominatimQ: 'Preston, VIC, Australia' },
      { key: 'reservoir',  label: 'Reservoir',       center: [-37.7180, 145.0060], zoom: 14, nominatimQ: 'Reservoir, VIC, Australia' },
      { key: 'ivanhoe',    label: 'Ivanhoe',         center: [-37.7670, 145.0450], zoom: 15, nominatimQ: 'Ivanhoe, VIC, Australia' },
      { key: 'heidelberg', label: 'Heidelberg',      center: [-37.7570, 145.0710], zoom: 15, nominatimQ: 'Heidelberg, VIC, Australia' },
      { key: 'moonee',     label: 'Moonee Ponds',    center: [-37.7650, 144.9190], zoom: 15, nominatimQ: 'Moonee Ponds, VIC, Australia' },
      { key: 'essendon',   label: 'Essendon',        center: [-37.7470, 144.9140], zoom: 15, nominatimQ: 'Essendon, VIC, Australia' },
      { key: 'pascoevale', label: 'Pascoe Vale',     center: [-37.7260, 144.9360], zoom: 14, nominatimQ: 'Pascoe Vale, VIC, Australia' },
      { key: 'bundoora',   label: 'Bundoora',        center: [-37.6960, 145.0570], zoom: 13, nominatimQ: 'Bundoora, VIC, Australia' }
    ]
  }
}

const activeRegion = ref<RegionKey>('city')
const activeSub = ref<Sub | null>(null)
const subregions = computed(() => regionDefs[activeRegion.value].sub ?? [])

let map: L.Map | null = null
let highlight: L.CircleMarker | null = null
let boundaryLayer: L.GeoJSON<any> | null = null
const loadingKey = ref<string | null>(null)

// —— Nominatim GeoJSON 缓存，避免重复请求 & 降低频率限制影响
const boundaryCache = new Map<string, any>()

function initMap() {
  map = L.map('map', {
    center: regionDefs.city.center,
    zoom: regionDefs.city.zoom,
    zoomControl: true
  })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map!)
}

function flyTo(loc: [number, number], z: number) {
  if (!map) return
  map.flyTo(loc, z, { duration: 0.8 })
}

function clearOverlays() {
  if (highlight && map) { map.removeLayer(highlight); highlight = null }
  if (boundaryLayer && map) { map.removeLayer(boundaryLayer); boundaryLayer = null }
}

function selectRegion(key: RegionKey) {
  activeRegion.value = key
  activeSub.value = null
  clearOverlays()
  const r = regionDefs[key]
  flyTo(r.center, Math.max(r.zoom, 12)) // 大区层级略大
}

async function selectSub(s: Sub) {
  activeSub.value = s
  loadingKey.value = s.key
  try {
    await zoomToSubWithBoundary(s)
  } catch (e) {
    // 回退：中心点 + 更大 zoom，并放一个 marker 让用户不迷路
    fallbackZoomToSub(s)
  } finally {
    loadingKey.value = null
  }
}

function fallbackZoomToSub(s: Sub) {
  clearOverlays()
  flyTo(s.center, Math.max(s.zoom ?? 16, 16))
  if (map) {
    highlight = L.circleMarker(s.center, { radius: 8, weight: 2 }).addTo(map)
  }
}

async function zoomToSubWithBoundary(s: Sub) {
  if (!map) return
  const key = s.nominatimQ || `${s.label}, VIC, Australia`

  // 读缓存
  let feature: any | null = boundaryCache.get(key) || null
  if (!feature) {
    // Query Nominatim GeoJSON（可能受到 CORS/频控影响）
    const url = `https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&limit=5&q=${encodeURIComponent(key)}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    const data = await res.json() as { type: string; features: any[] }
    if (!data?.features?.length) throw new Error('No features')
    // 选一个最像的：优先 polygon，且包含 VIC 的命名（简单启发式）
    feature = pickBestFeature(data.features, s.label)
    if (!feature) throw new Error('No suitable polygon')
    boundaryCache.set(key, feature)
  }

  // 画边界
  clearOverlays()
  boundaryLayer = L.geoJSON(feature.geometry, {
    style: {
      color: '#2c7be5',
      weight: 2,
      fillColor: '#2c7be5',
      fillOpacity: 0.12
    }
  }).addTo(map)

  // 根据边界自适应视野，并稍加 padding（比不规则区域更大一点）
  const bounds = boundaryLayer.getBounds()
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 })
}

// 简单挑选一个最合理的要素（更偏向 Polygon，且名字包含 suburb 名称）
function pickBestFeature(features: any[], label: string) {
  const lower = label.toLowerCase()
  // 按优先级排序：Polygon/Multipolygon > 其他；名字包含 label > 其他；面积较大者优先
  const scored = features
    .map(f => {
      const name = (f.properties?.display_name || '').toLowerCase()
      const type = f.geometry?.type || ''
      const polyScore = /polygon/i.test(type) ? 2 : 0
      const nameScore = name.includes(lower) ? 1 : 0
      const areaScore = estimateFeatureArea(f.geometry) // 粗略面积
      return { f, score: polyScore * 1000 + nameScore * 100 + areaScore }
    })
    .sort((a, b) => b.score - a.score)
  return scored[0]?.f || null
}

// 非精确：粗略估算 MultiPolygon/Polygon 的“面积分”，仅用于排序
function estimateFeatureArea(geom: any): number {
  if (!geom) return 0
  const coords = geom.coordinates
  if (!coords) return 0
  const type = geom.type
  const rings = type === 'Polygon' ? [coords] : (type === 'MultiPolygon' ? coords : [])
  let accum = 0
  for (const poly of rings) {
    // poly: [ [lng,lat], ... ] 的数组（外环 + 内环），这里仅取外环
    const outer = poly?.[0]
    if (!outer) continue
    accum += outer.length
  }
  return accum
}

onMounted(() => {
  initMap()
  const r = regionDefs[activeRegion.value]
  flyTo(r.center, r.zoom)
})
onBeforeUnmount(() => {
  if (map) { map.remove(); map = null }
})
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; display:flex; justify-content:center; background:#f5f7fa; }
.container { width: 80vw; margin: 0 auto; padding: 16px 0 24px; display:flex; flex-direction:column; gap:12px; }
.filters, .subfilters { display:flex; justify-content:center; gap:8px; flex-wrap:wrap; }
.map {
  width: 100%;
  height: calc(100vh - 200px);
  min-height: 520px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(0,0,0,0.08);
  background: #fff;
}
</style>
