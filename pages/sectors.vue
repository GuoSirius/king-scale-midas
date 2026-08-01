<script setup lang="ts">
const { data, pending } = useFetch('/api/sectors', { default: () => ({ tradeDate: null, sectors: [] as any[] }) })
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-700">板块热度 <span v-if="data.tradeDate" class="text-white/40 text-base">· {{ data.tradeDate }}</span></h1>

    <div v-if="pending" class="text-white/50">加载中…</div>
    <div v-else-if="!data.sectors.length" class="text-white/50 card">暂无板块数据。</div>
    <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div v-for="s in data.sectors" :key="s.id" class="card magnetic">
        <div class="flex items-center justify-between">
          <span class="font-600">{{ s.sectorId }}</span>
          <span class="text-up font-700">{{ s.limitUpCount }} 涨停</span>
        </div>
        <div class="mt-2 text-white/50 text-sm">平均涨幅 {{ s.avgPct != null ? s.avgPct + '%' : '—' }}</div>
        <div class="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div class="h-full bg-gradient-to-r from-gold-deep to-gold" :style="{ width: Math.min(100, (s.limitUpCount || 0) * 8) + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>
