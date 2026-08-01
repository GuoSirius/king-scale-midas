<script setup lang="ts">
const { init } = useTheme()
const { data: me } = useFetch('/api/auth/me', { lazy: true, default: () => ({ user: null }) })

onMounted(() => init())

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  location.reload()
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-50 glass-dark border-b border-white/10">
      <nav class="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
        <NuxtLink to="/" class="flex items-center gap-2 font-600 shrink-0">
          <img src="/favicon.svg" class="w-7 h-7" alt="金鳞·点石" />
          <span class="text-gradient text-lg">金鳞·点石</span>
        </NuxtLink>
        <div class="flex-1 flex gap-1 text-sm text-white/70 overflow-x-auto">
          <NuxtLink to="/" exact-active-class="text-gold" class="px-3 py-1.5 rounded-lg hover:text-gold whitespace-nowrap">首页</NuxtLink>
          <NuxtLink to="/limit-up" active-class="text-gold" class="px-3 py-1.5 rounded-lg hover:text-gold whitespace-nowrap">涨停</NuxtLink>
          <NuxtLink to="/limit-down" active-class="text-gold" class="px-3 py-1.5 rounded-lg hover:text-gold whitespace-nowrap">跌停</NuxtLink>
          <NuxtLink to="/sectors" active-class="text-gold" class="px-3 py-1.5 rounded-lg hover:text-gold whitespace-nowrap">板块</NuxtLink>
        </div>
        <ThemeToggle />
        <template v-if="me && me.user">
          <NuxtLink v-if="me.user.role === 'admin'" to="/admin" class="px-3 py-1.5 rounded-lg text-gold hover:bg-gold/10 whitespace-nowrap">后台</NuxtLink>
          <span class="text-sm text-white/60 hidden sm:inline">{{ me.user.username }}</span>
          <button class="px-3 py-1.5 rounded-lg glass hover:text-up whitespace-nowrap" @click="logout">退出</button>
        </template>
        <template v-else>
          <NuxtLink to="/login" class="px-3 py-1.5 rounded-lg hover:text-gold whitespace-nowrap">登录</NuxtLink>
          <NuxtLink to="/register" class="btn-gold whitespace-nowrap">注册</NuxtLink>
        </template>
      </nav>
    </header>

    <main class="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
      <slot />
    </main>

    <footer class="border-t border-white/10 py-6 text-center text-xs text-white/40">
      金鳞·点石 · A股盘后涨跌停复盘 · 数据来自公开接口，仅供研究学习
    </footer>
  </div>
</template>
