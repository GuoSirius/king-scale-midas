import {
  defineConfig,
  presetUno,
  presetAttributify,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup
} from 'unocss'

// 金鳞·点石 设计系统
// 暗色为默认（盘后复盘场景），明色为可选主题
export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    // FontAwesome 6（纯 CSS，零运行时）：i-fa6-solid:* / i-fa6-regular:* / i-fa6-brands:*
    presetIcons({
      scale: 1.1,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle'
      }
    })
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup()
  ],
  theme: {
    colors: {
      // 品牌金（金鳞 / 点石成金）
      gold: {
        DEFAULT: '#E8B339',
        soft: '#F5C451',
        deep: '#C8922A',
        glow: '#FFD77A'
      },
      // 鳞（青玉点缀，象征龙鳞/水）
      jade: {
        DEFAULT: '#3FB8A0',
        soft: '#5FD3BC',
        deep: '#2C8474'
      },
      // 涨/跌
      up: '#F5455C',     // 红涨（A股习惯）
      down: '#1FB86B',   // 绿跌
      // 中性背景
      ink: {
        900: '#0b0b0f',
        800: '#121219',
        700: '#1b1b25',
        600: '#262633',
        500: '#363646'
      }
    },
    fontFamily: {
      sans: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
      mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
    },
    boxShadow: {
      glow: '0 0 30px -5px rgba(232,179,57,0.45)'
    }
  },
  shortcuts: {
    'glass': 'bg-white/5 backdrop-blur-xl border border-white/10',
    'glass-dark': 'bg-ink-800/70 backdrop-blur-xl border border-white/10',
    'btn-gold': 'bg-gold text-ink-900 font-600 px-4 py-2 rounded-xl hover:bg-gold-soft transition shadow-glow',
    'card': 'glass rounded-2xl p-5'
  }
})
