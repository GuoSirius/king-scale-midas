<script setup lang="ts">
const route = useRoute()
const code = computed(() => String(route.params.code))
const { data, pending } = useFetch(() => `/api/stocks/${code.value}`, { default: () => ({ stock: null, history: [] as any[] }) })
const { data: me } = useFetch('/api/auth/me', { lazy: true, default: () => ({ user: null }) })

const editingId = ref<number | null>(null)
const draft = ref('')
const msg = ref('')
async function saveReason(id: number) {
  msg.value = ''
  try {
    await $fetch(`/api/records/${id}`, { method: 'PATCH', body: { reason_override: draft.value } })
    msg.value = '已提交补全，感谢贡献！'
    editingId.value = null
    draft.value = ''
  } catch (e: any) {
    msg.value = e.data?.statusMessage || '提交失败'
  }
}
const reason = (r: any) => r.reason_final || r.reason_raw || '未收录'
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/limit-up" class="text-white/50 text-sm hover:text-gold">← 返回涨停列表</NuxtLink>

    <div v-if="pending" class="text-white/50">加载中…</div>
    <template v-else>
      <header class="card flex items-center gap-4">
        <div>
          <h1 class="text-2xl font-700">{{ data.stock?.name || code }}</h1>
          <div class="text-white/50 font-mono text-sm mt-1">{{ data.stock?.code }} · {{ data.stock?.board }} <span v-if="data.stock?.isSt" class="text-up">ST</span></div>
        </div>
      </header>

      <h2 class="text-lg font-600">涨跌停历史（{{ data.history.length }} 次）</h2>
      <div class="card p-0 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-white/40 text-left">
            <tr class="border-b border-white/10">
              <th class="p-3">日期</th><th>类型</th><th>连板</th><th>涨跌幅</th><th>首次封板</th><th>原因</th><th v-if="me.user"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data.history" :key="r.id" class="border-b border-white/5 align-top">
              <td class="p-3 font-mono">{{ r.tradeDate }}</td>
              <td>
                <span :class="r.limitType === 'up' ? 'text-up' : 'text-down'">{{ r.limitType === 'up' ? '涨停' : '跌停' }}</span>
              </td>
              <td>{{ r.ztCount > 1 ? r.ztCount + '连板' : '首板' }}</td>
              <td :class="r.limitType === 'up' ? 'text-up' : 'text-down'">{{ r.pct }}%</td>
              <td class="text-white/60">{{ r.firstLimitTime || '—' }}</td>
              <td class="max-w-[280px]">
                <div>{{ reason(r) }} <span v-if="r.isVerified" class="text-jade text-xs">✓已校</span></div>
                <div v-if="r.tags?.length" class="flex flex-wrap gap-1 mt-1">
                  <span v-for="t in r.tags" :key="t.id" class="text-gold-soft text-xs glass px-2 py-0.5 rounded-full">{{ t.name }}</span>
                </div>
                <div v-if="editingId === r.id" class="mt-2 space-y-2">
                  <textarea v-model="draft" rows="2" placeholder="补全涨停原因…" class="w-full bg-ink-800 rounded-lg p-2 text-sm border border-white/10"></textarea>
                  <div class="flex gap-2">
                    <button class="btn-gold text-sm py-1" @click="saveReason(r.id)">提交</button>
                    <button class="glass px-3 py-1 rounded-lg text-sm" @click="editingId = null">取消</button>
                  </div>
                </div>
              </td>
              <td v-if="me.user">
                <button class="text-gold text-sm hover:underline" @click="editingId = r.id; draft = ''">补全</button>
              </td>
            </tr>
            <tr v-if="!data.history.length"><td colspan="7" class="p-6 text-center text-white/40">无涨跌停记录</td></tr>
          </tbody>
        </table>
      </div>
      <p v-if="msg" class="text-jade text-sm">{{ msg }}</p>
    </template>
  </div>
</template>
