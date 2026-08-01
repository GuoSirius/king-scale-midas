<script setup lang="ts">
const filters = reactive({ date: '', board: '', minZt: 0, q: '' })
const query = computed(() => ({
  date: filters.date || undefined,
  board: filters.board || undefined,
  minZt: filters.minZt || undefined,
  q: filters.q || undefined,
}))
const { data, pending } = useFetch('/api/limit-up', { query, default: () => ({ total: 0, rows: [] as any[] }) })

const boardLabel: Record<string, string> = { main: '主板', cyb: '创业板', star: '科创板', bse: '北交所' }
const reason = (r: any) => r.reason_final || r.reason_raw || '—'
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-700">涨停 <span class="text-up">▲</span> <span class="text-white/40 text-base">共 {{ data.total }} 条</span></h1>

    <!-- 筛选 -->
    <div class="glass rounded-2xl p-4 flex flex-wrap gap-3 items-end">
      <label class="text-sm text-white/60 flex flex-col gap-1">
        日期
        <input v-model="filters.date" type="date" class="bg-ink-800 rounded-lg px-3 py-1.5 text-sm border border-white/10" />
      </label>
      <label class="text-sm text-white/60 flex flex-col gap-1">
        板块
        <select v-model="filters.board" class="bg-ink-800 rounded-lg px-3 py-1.5 text-sm border border-white/10">
          <option value="">全部</option>
          <option value="main">主板</option>
          <option value="cyb">创业板</option>
          <option value="star">科创板</option>
          <option value="bse">北交所</option>
        </select>
      </label>
      <label class="text-sm text-white/60 flex flex-col gap-1">
        连板≥
        <input v-model.number="filters.minZt" type="number" min="0" class="bg-ink-800 rounded-lg px-3 py-1.5 text-sm w-20 border border-white/10" />
      </label>
      <label class="text-sm text-white/60 flex flex-col gap-1 flex-1 min-w-[160px]">
        搜索
        <input v-model="filters.q" placeholder="代码 / 名称" class="bg-ink-800 rounded-lg px-3 py-1.5 text-sm border border-white/10" />
      </label>
    </div>

    <div v-if="pending" class="text-white/50">加载中…</div>
    <div v-else class="card p-0 overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-white/40 text-left">
          <tr class="border-b border-white/10">
            <th class="p-3">代码</th><th>名称</th><th>连板</th><th>涨停价</th>
            <th>涨跌幅</th><th>首次封板</th><th>炸板</th><th>原因</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in data.rows" :key="r.id" class="border-b border-white/5 hover:bg-white/5">
            <td class="p-3 font-mono">{{ r.stockCode }}</td>
            <td class="font-600">{{ r.stockName }}</td>
            <td>
              <span v-if="r.ztCount > 1" class="text-gold font-700">{{ r.ztCount }} 连板</span>
              <span v-else class="text-white/50">首板</span>
            </td>
            <td class="font-mono">{{ r.price }}</td>
            <td class="text-up">+{{ r.pct }}%</td>
            <td class="text-white/60">{{ r.firstLimitTime || '—' }}</td>
            <td class="text-white/60">{{ r.openTimes }}</td>
            <td class="text-white/70 max-w-[260px] truncate">{{ reason(r) }}</td>
            <td><NuxtLink :to="`/stocks/${r.stockCode}`" class="text-gold hover:underline whitespace-nowrap">详情</NuxtLink></td>
          </tr>
          <tr v-if="!data.rows.length"><td colspan="9" class="p-6 text-center text-white/40">暂无数据</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
