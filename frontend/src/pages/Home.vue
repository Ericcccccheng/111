<template>
  <div class="page">
    <div class="container">
      <!-- 顶部控制条：分页信息 + 刷新 -->
      <div class="toolbar">
        <div class="left">
          <b>公司列表</b>
          <span v-if="!loading" class="muted">（共 {{ total }} 条，当前第 {{ page }} / {{ Math.max(1, Math.ceil(total/pageSize)) }} 页）</span>
        </div>
        <div class="right">
          <el-button size="small" @click="reload" :loading="loading">刷新</el-button>
        </div>
      </div>

      <!-- 列表 -->
      <el-card v-for="(c, i) in list" :key="i" class="row">
        <div class="row-main">
          <div class="name">{{ c.name }}</div>
          <div class="addr">{{ c.address }}</div>
          <div class="desc" v-if="c.details">{{ c.details }}</div>
        </div>
        <div class="row-actions">
          <el-button
            :disabled="!hasCoord(c)"
            type="primary"
            link
            @click="locate(c)"
            :title="hasCoord(c) ? '在地图上查看' : '暂无坐标'"
          >
            <el-icon><Location /></el-icon>
          </el-button>
        </div>
      </el-card>

      <!-- 分页条 -->
      <div class="pager">
        <el-pagination
          background
          layout="prev, pager, next, ->, total"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="onPageChange"
        />
      </div>

      <div v-if="error" class="error">加载失败：{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Location } from '@element-plus/icons-vue'

type Company = {
  name: string
  address: string
  details?: string
  lat?: number | null
  lng?: number | null
}

const router = useRouter()

const list = ref<Company[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const error = ref<string | null>(null)

function hasCoord(c:Company){
  return typeof c.lat === 'number' && typeof c.lng === 'number'
}

async function load(){
  loading.value = true
  error.value = null
  try{
    const res = await fetch(`/company/index?page=${page.value}&limit=${pageSize.value}`, {
      headers:{ Accept:'application/json' }
    })
    if(!res.ok){
      throw new Error(`HTTP ${res.status}`)
    }
    const j = await res.json()
    if(!j?.ok) throw new Error(j?.msg || 'unknown error')
    list.value  = j.data || []
    total.value = j.total || 0
  }catch(e:any){
    error.value = e?.message || String(e)
    list.value = []
  }finally{
    loading.value = false
  }
}

function onPageChange(p:number){
  page.value = p
  load()
}

function reload(){ load() }

function locate(c:Company){
  if(!hasCoord(c)){
    ElMessage.warning('该公司暂无坐标')
    return
  }
  router.push({
    name: 'map', // 确保你的路由里 Map 页的 name 是 'map'
    query: {
      lat: String(c.lat),
      lng: String(c.lng),
      name: c.name,
      details: c.details || ''
    }
  })
}

onMounted(load)
</script>

<style scoped>
.page{ width:100%; display:flex; justify-content:center; background:#f5f7fa; }
.container{ width:80vw; max-width:1100px; padding:16px 0 32px; display:flex; flex-direction:column; gap:12px; }
.toolbar{ display:flex; justify-content:space-between; align-items:center; padding:8px 4px; }
.toolbar .muted{ color:#6b7280; margin-left:8px; }
.row{ display:flex; justify-content:space-between; align-items:center; padding:10px 12px; }
.row + .row{ margin-top:6px; }
.row-main{ flex:1; min-width:0; }
.name{ font-weight:600; }
.addr{ color:#4b5563; }
.desc{ color:#6b7280; font-size:13px; margin-top:4px; }
.row-actions{ width:42px; display:flex; justify-content:flex-end; }
.pager{ display:flex; justify-content:center; margin-top:8px; }
.error{ color:#dc2626; }
</style>
