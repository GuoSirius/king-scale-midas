<script setup lang="ts">
import type { FetchError } from 'ofetch'

const email = ref('')
const password = ref('')
const err = ref('')
const loading = ref(false)
const route = useRoute()
const { user, loaded } = useSession()

async function submit() {
  err.value = ''
  loading.value = true
  try {
    const res = await $fetch('/api/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
    // 关键：登录成功后必须把用户信息写进客户端会话状态，否则全站鉴权中间件
    // 读到 user=null 会立刻把刚登录的用户弹回 /login（表现为“登录不跳转/进不去其他页”）。
    user.value = res.user
    loaded.value = true
    const redirect = (route.query.redirect as string) || (res.user.role === 'admin' ? '/admin' : '/')
    await navigateTo(redirect)
  } catch (e) {
    if (e instanceof FetchError) {
      err.value = (e.data as { statusMessage?: string })?.statusMessage || e.message || '登录失败'
    } else {
      err.value = '登录失败'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-12">
    <form class="card space-y-4" @submit.prevent="submit">
      <h1 class="text-xl font-700">登录</h1>
      <label class="block text-sm text-white/60">邮箱
        <input
          v-model="email" type="email" autocomplete="username" required
          class="mt-1 w-full bg-ink-800 rounded-lg px-3 py-2 border border-white/10" />
      </label>
      <label class="block text-sm text-white/60">密码
        <input
          v-model="password" type="password" autocomplete="current-password" required
          class="mt-1 w-full bg-ink-800 rounded-lg px-3 py-2 border border-white/10" />
      </label>
      <p v-if="err" class="text-up text-sm">{{ err }}</p>
      <button type="submit" class="btn-gold w-full" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button>
      <p class="text-white/40 text-sm text-center">还没有账号？<NuxtLink to="/register" class="text-gold hover:underline">注册</NuxtLink></p>
      <p class="text-white/30 text-xs text-center">新账号需管理员审核通过后才能登录</p>
    </form>
  </div>
</template>
