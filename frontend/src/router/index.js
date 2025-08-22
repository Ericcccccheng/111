import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/pages/Home.vue'
import MapPage from '@/pages/Map.vue'

const routes = [
  { path: '/',     name: 'home', component: Home },
  { path: '/map',  name: 'map',  component: MapPage }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
