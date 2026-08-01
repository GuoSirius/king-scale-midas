// 金鳞·点石 代码规范（见 docs/guide/代码规范.md）
// 基于 @nuxt/eslint 生成的 .nuxt/eslint.config.mjs（含 Vue / TS / Nuxt 自动导入 globals）
// 在其基础上叠加 @stylistic 风格规则。withNuxt 会自动生成为自动导入的类型声明。
import { withNuxt } from './.nuxt/eslint.config.mjs'
import stylistic from '@stylistic/eslint-plugin'

export default withNuxt(
  // 基础 JS/TS 规则
  {
    files: ['**/*.{ts,js,mjs,vue}'],
    plugins: {
      '@stylistic': stylistic
    },
    rules: {
      // 未使用的变量 / 导入 → 报错（下划线前缀 _ 可豁免）
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // 未定义的变量 / 引用 → 报错（Nuxt 自动导入全局由 @nuxt/eslint 注入 globals）
      'no-undef': 'error',
      // any 仅告警（非本次规范强制项，避免大范围改写既有 catch 分支）
      '@typescript-eslint/no-explicit-any': 'warn',
      // 风格：无分号
      '@stylistic/semi': ['error', 'never'],
      // 两空格缩进
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      // 箭头函数参数始终带圆括号
      '@stylistic/arrow-parens': ['error', 'always'],
      // 文件末尾留一行空行
      '@stylistic/eol-last': ['error', 'always'],
      // 空行最多一个（文件首尾不允许空行）
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1, maxBOF: 0 }],
      // 对象 / 数组最后一个元素不加逗号
      '@stylistic/comma-dangle': ['error', 'never']
    }
  },
  // Vue 模板规则
  {
    files: ['**/*.vue'],
    rules: {
      // 单文件组件名允许单词（layouts/pages 等）
      'vue/multi-word-component-names': 'off',
      // 模板两空格缩进
      'vue/html-indent': ['error', 2],
      // HTML 标签必须正确闭合（void 元素自闭合，普通/组件元素成对非自闭合）
      'vue/html-self-closing': ['error', {
        html: { void: 'always', normal: 'never', component: 'always' },
        svg: 'always',
        math: 'always'
      }],
      // Vue 属性书写顺序（采用官方默认顺序）
      'vue/attributes-order': 'error',
      // 模板属性 / 事件使用 kebab-case（连字符）
      'vue/attribute-hyphenation': ['error', 'always'],
      'vue/v-on-event-hyphenation': ['error', 'always']
    }
  },
  // 忽略目录
  {
    ignores: [
      'node_modules/**',
      '.nuxt/**',
      '.output/**',
      'dist/**',
      'collector/**',
      'docs/**',
      '**/*.md'
    ]
  }
)
