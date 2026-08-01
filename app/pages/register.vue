<script setup lang="ts">
const email = ref('')
const username = ref('')
const password = ref('')
const err = ref('')
const done = ref(false)
const loading = ref(false)

async function submit() {
  err.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/register', { method: 'POST', body: { email: email.value, username: username.value, password: password.value } })
    done.value = true
  } catch (e: any) {
    err.value = e.data?.statusMessage || e.message || '注册失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-12">
    <div class="card space-y-4">
      <h1 class="text-xl font-700">注册</h1>
      <p v-if="done" class="text-jade text-sm">注册成功！请等待管理员审核通过后登录。</p>
      <template v-else>
        <label class="block text-sm text-white/60">用户名
          <input v-model="username" class="mt-1 w-full bg-ink-800 rounded-lg px-3 py-2 border border-white/10" />
        </label>
        <label class="block text-sm text-white/60">邮箱
          <input v-model="email" type="email" autocomplete="email" class="mt-1 w-full bg-ink-800 rounded-lg px-3 py-2 border border-white/10" />
        </label>
        <label class="block text-sm text-white/60">密码（≥8 位）
          <input v-model="password" type="password" autocomplete="new-password" class="mt-1 w-full bg-ink-800 rounded-lg px-3 py-2 border border-white/10" />
        </label>
        <p v-if="err" class="text-up text-sm">{{ err }}</p>
        <button class="btn-gold w-full" :disabled="loading" @click="submit">{{ loading ? '提交中…' : '注册' }}</button>
        <p class="text-white/40 text-sm text-center">已有账号？<NuxtLink to="/login" class="text-gold hover:underline">登录</NuxtLink></p>
      </template>
    </div>
  </div>
</template>
