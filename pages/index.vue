<script setup lang="ts">
const { data, pending, error } = useFetch('/api/summary')

const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
</script>

<template>
  <div class="space-y-8">
    <!-- Hero -->
    <section class="relative overflow-hidden glass rounded-3xl p-8 md:p-12">
      <div class="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gold/20 blur-3xl"></div>
      <h1 class="text-3xl md:text-4xl font-700 leading-tight">
        金鳞岂是池中物<br />
        <span class="text-gradient">一遇风云便化龙</span>
      </h1>
      <p class="mt-3 text-white/60 max-w-xl">
        每日盘后记录 A股涨跌停：名称、代码、涨停原因、所属板块与行业。把零散的盘后数据，沉淀为可检索、可复盘、可验证的资产。
      </p>
      <div class="mt-6 flex gap-3">
        <NuxtLink to="/limit-up" class="btn-gold">查看今日涨停</NuxtLink>
        <NuxtLink to="/sectors" class="glass px-4 py-2 rounded-xl hover:text-gold">板块热度</NuxtLink>
      </div>
    </section>

    <!-- 情绪面板 -->
    <section v-if="pending" class="text-white/50">加载市场情绪…</section>
    <section v-else-if="error" class="text-up">数据加载失败：{{ error.statusMessage }}</section>
    <section v-else-if="data?.summary" class="space-y-6">
      <div class="text-white/50 text-sm">交易日 {{ data.summary.tradeDate }}</div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="card">
          <div class="text-white/50 text-xs">涨停</div>
          <div class="text-2xl font-700 text-up mt-1">{{ data.summary.limitUpCount }}</div>
        </div>
        <div class="card">
          <div class="text-white/50 text-xs">跌停</div>
          <div class="text-2xl font-700 text-down mt-1">{{ data.summary.limitDownCount }}</div>
        </div>
        <div class="card">
          <div class="text-white/50 text-xs">连板高度</div>
          <div class="text-2xl font-700 text-gold mt-1">{{ data.summary.ztHeight }}</div>
        </div>
        <div class="card">
          <div class="text-white/50 text-xs">首板数</div>
          <div class="text-2xl font-700 mt-1">{{ data.summary.firstBoardCount }}</div>
        </div>
        <div class="card">
          <div class="text-white/50 text-xs">涨停打开</div>
          <div class="text-2xl font-700 mt-1">{{ data.summary.limitUpOpenCount }}</div>
        </div>
        <div class="card">
          <div class="text-white/50 text-xs">封板率</div>
          <div class="text-2xl font-700 text-jade mt-1">{{ pct(data.summary.sealRate) }}</div>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
        <!-- 热门板块 -->
        <div class="card">
          <h2 class="font-600 mb-3">热门板块</h2>
          <ul class="space-y-2">
            <li v-for="s in data.topSectors" :key="String(s.sectorId ?? s.id ?? s.rank ?? '')" class="flex items-center justify-between text-sm">
              <span class="text-white/80">{{ s.sectorId }}</span>
              <span class="text-up font-600">涨停 {{ s.limitUpCount }}</span>
            </li>
            <li v-if="!data.topSectors.length" class="text-white/40 text-sm">暂无数据</li>
          </ul>
        </div>
        <!-- 热门题材 -->
        <div class="card">
          <h2 class="font-600 mb-3">热门题材</h2>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="c in data.topConcepts"
              :key="c.id"
              class="glass px-3 py-1 rounded-full text-sm text-gold-soft"
            >{{ c.name }} <span class="text-white/40">×{{ c.count }}</span></span>
            <span v-if="!data.topConcepts.length" class="text-white/40 text-sm">暂无数据</span>
          </div>
        </div>
      </div>
    </section>

    <section v-else class="text-white/50 card">暂无复盘数据。配置采集器（GitHub Actions 或本地 `python collector/run.py`）后，盘后自动入库。</section>
  </div>
</template>
