<script setup lang="ts">
const { theme, set } = useTheme()
type ThemeMode = 'dark' | 'light' | 'system'
const cycle = () => {
  const order: ThemeMode[] = ['dark', 'light', 'system']
  const current = (theme.value as ThemeMode | undefined) ?? 'system'
  const i = order.indexOf(current)
  set(order[(i + 1) % order.length]!)
}
</script>

<template>
  <button
    class="magnetic glass flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-white/80 hover:text-gold"
    :title="`主题：${theme}`"
    @click="cycle"
  >
    <i v-if="theme === 'dark'" class="i-fa6-solid:moon w-4 h-4"></i>
    <i v-else-if="theme === 'light'" class="i-fa6-solid:sun w-4 h-4"></i>
    <i v-else class="i-fa6-solid:circle-half-stroke w-4 h-4"></i>
    <span>{{ theme === 'dark' ? '暗' : theme === 'light' ? '亮' : '随' }}</span>
  </button>
</template>
