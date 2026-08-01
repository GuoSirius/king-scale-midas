<script setup lang="ts">
const { theme, set } = useTheme()
const cycle = () => {
  const order = ['dark', 'light', 'system'] as const
  const i = order.indexOf(theme.value)
  set(order[(i + 1) % order.length])
}
</script>

<template>
  <button
    class="magnetic glass flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-white/80 hover:text-gold"
    :title="`主题：${theme}`"
    @click="cycle"
  >
    <!-- 暗 -->
    <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
    </svg>
    <!-- 亮 -->
    <svg v-else-if="theme === 'light'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </svg>
    <!-- 随系统 -->
    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" />
    </svg>
    <span>{{ theme === 'dark' ? '暗' : theme === 'light' ? '亮' : '随' }}</span>
  </button>
</template>
