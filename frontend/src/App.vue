<template>
  <div class="app">
    <header class="nav">
      <router-link to="/" class="link" active-class="active">首页</router-link>
      <router-link to="/map" class="link" active-class="active">地图</router-link>
    </header>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
// 这里不需要脚本逻辑；路由已在 main.ts 里 use(router)
</script>

<style>
/* 全局一些基础样式（不要 scoped，导航需要是全局），你可按需调整 */
:root {
  --nav-height: 56px;
  --nav-bg: #ffffff;
  --nav-border: #e5e7eb;
  --nav-text: #374151;
  --nav-active: #2563eb;
}

html, body, #app {
  height: 100%;
  margin: 0;
}

.app {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.nav {
  height: var(--nav-height);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--nav-bg);
  border-bottom: 1px solid var(--nav-border);
}

.link {
  text-decoration: none;
  color: var(--nav-text);
  padding: 6px 10px;
  border-radius: 8px;
  font-weight: 600;
}

.link.active {
  color: #fff;
  background: var(--nav-active);
}

.main {
  flex: 1;
  /* 页面组件里自己有 80% 宽度容器，这里不再限定宽 */
}
</style>
