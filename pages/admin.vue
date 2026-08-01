<script setup lang="ts">
const { data: me } = useFetch('/api/auth/me', { lazy: true, default: () => ({ user: null }) })
const { data: pend, refresh: refreshPend } = useFetch('/api/admin/pending', { default: () => ({ users: [] as any[] }) })
const { data: runs } = useFetch('/api/admin/ingest-runs', { default: () => ({ runs: [] as any[] }) })

watch(() => me.value?.user, (u) => {
  if (u && u.role !== 'admin') navigateTo('/')
}, { immediate: true })

async function approve(id: number) {
  await $fetch(`/api/admin/users/${id}/approve`, { method: 'POST' })
  refreshPend()
}
async function disable(id: number) {
  await $fetch(`/api/admin/users/${id}/disable`, { method: 'POST' })
  refreshPend()
}

// 原因修订（管理员）
const recId = ref('')
const reasonText = ref('')
const reasonMsg = ref('')
async function saveReason() {
  reasonMsg.value = ''
  try {
    await $fetch(`/api/admin/records/${recId.value}`, { method: 'PATCH', body: { reason_final: reasonText.value } })
    reasonMsg.value = '已保存并标记为已校订'
    recId.value = ''
    reasonText.value = ''
  } catch (e: any) {
    reasonMsg.value = e.data?.statusMessage || '保存失败'
  }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-2xl font-700">管理后台</h1>

    <!-- 待审核用户 -->
    <section class="space-y-3">
      <h2 class="text-lg font-600">待审核用户（{{ pend.users.length }}）</h2>
      <div v-if="!pend.users.length" class="text-white/40 text-sm">暂无待审核用户</div>
      <div v-else class="space-y-2">
        <div v-for="u in pend.users" :key="u.id" class="card flex items-center justify-between flex-wrap gap-2">
          <div>
            <div class="font-600">{{ u.username }} <span class="text-white/40 text-sm">#{{ u.id }}</span></div>
            <div class="text-white/50 text-sm">{{ u.email }} · 注册于 {{ u.createdAt }}</div>
          </div>
          <div class="flex gap-2">
            <button class="btn-gold text-sm py-1" @click="approve(u.id)">通过</button>
            <button class="glass px-3 py-1 rounded-lg text-sm hover:text-up" @click="disable(u.id)">禁用</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 采集运行监控 -->
    <section class="space-y-3">
      <h2 class="text-lg font-600">采集运行监控</h2>
      <div class="card p-0 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-white/40 text-left">
            <tr class="border-b border-white/10">
              <th class="p-3">时间</th><th>数据源</th><th>交易日</th><th>状态</th><th>获取</th><th>新增</th><th>更新</th><th>跳过</th><th>耗时</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in runs.runs" :key="r.id" class="border-b border-white/5">
              <td class="p-3 font-mono text-white/60">{{ r.runAt }}</td>
              <td>{{ r.source }}</td>
              <td class="font-mono">{{ r.tradeDate }}</td>
              <td :class="r.status === 'success' ? 'text-jade' : 'text-up'">{{ r.status }}</td>
              <td>{{ r.fetched }}</td><td>{{ r.inserted }}</td><td>{{ r.updated }}</td><td>{{ r.skipped }}</td>
              <td class="text-white/60">{{ r.durationMs }}ms</td>
            </tr>
            <tr v-if="!runs.runs.length"><td colspan="9" class="p-6 text-center text-white/40">暂无采集记录</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 原因修订 -->
    <section class="space-y-3">
      <h2 class="text-lg font-600">修订涨跌停原因（管理员）</h2>
      <div class="card space-y-3 max-w-lg">
        <label class="block text-sm text-white/60">记录 ID
          <input v-model="recId" type="number" class="mt-1 w-full bg-ink-800 rounded-lg px-3 py-2 border border-white/10" />
        </label>
        <label class="block text-sm text-white/60">涨停原因
          <textarea v-model="reasonText" rows="3" class="mt-1 w-full bg-ink-800 rounded-lg px-3 py-2 border border-white/10"></textarea>
        </label>
        <button class="btn-gold" @click="saveReason">保存并标记已校订</button>
        <p v-if="reasonMsg" class="text-jade text-sm">{{ reasonMsg }}</p>
      </div>
    </section>
  </div>
</template>
