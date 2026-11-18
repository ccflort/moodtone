window.__ModuleLoader__.load({
  id: 'moodtone',
  factory(require) {
    'use strict';

    const React = require('react');
    const h = React.createElement;
    const NS = 'moodtone';

    /* ────────────────────────────────────────────────────────────────
     * 想改什么，看这里
     *   · 六套配色 → SPECS（下面 6 个对象；只写 7 个值：bg/panel/sub/text/dim/line/accent）
     *   · 默认用哪套 → DEFAULT_THEME
     *   · 材质默认值 → MAT_DEFAULT
     *   · 玻璃/猫耳的 CSS → coreCss() / bubbleCss()
     * 改完保存即热重载；主题掉回浅色时按 Ctrl+R。
     * ──────────────────────────────────────────────────────────────── */

    const DEFAULT_THEME = 'acid';
    const STORE_THEME = 'moodtone:theme';
    const STORE_MAT = 'moodtone:material'; // v2：默认不磨砂，老配置作废一次
    const STORE_CUSTOM = 'moodtone:custom';
    const CSS_ID = 'moodtone-core-css';

    /* 主题 id 带命名空间：acid / rose 这种短名，别的插件大概率会撞。
     * 注册进 DSH 的是 'moodtone:acid'，本地存储里仍用短名（换命名空间不丢配置）。 */
    const ID_NS = 'moodtone:';
    const regId = (id) => ID_NS + id;
    const bareId = (id) => (typeof id === 'string' && id.indexOf(ID_NS) === 0 ? id.slice(ID_NS.length) : id);

    /* 卸载时要把主题偏好复位，否则 preference 指向一个已经注销的 id。
     * 但热重载也会走 dispose —— 用生存计数区分「真的走了」和「换了个实例」。 */
    const LIFE_KEY = '__moodToneLife__';

    /* ── 颜色工具 ─────────────────────────────────────────────────── */

    function toRgb(hex) {
      const value = String(hex).replace('#', '');
      const number = parseInt(value.length === 3 ? value.replace(/(.)/g, '$1$1') : value, 16);
      if (!Number.isFinite(number)) return [0, 0, 0];
      return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
    }

    function toHex(rgb) {
      return (
        '#' +
        rgb
          .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
          .join('')
      );
    }

    function mix(a, b, t) {
      const left = toRgb(a);
      const right = toRgb(b);
      const weight = Math.max(0, Math.min(1, t));
      return toHex(left.map((channel, index) => channel + (right[index] - channel) * weight));
    }

    function rgba(hex, alpha) {
      const [r, g, b] = toRgb(hex);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function luminance(hex) {
      const [r, g, b] = toRgb(hex).map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function readableOn(hex) {
      return luminance(hex) > 0.42 ? '#101418' : '#ffffff';
    }

    const lift = (hex, t) => mix(hex, '#ffffff', t);
    const shade = (hex, t) => mix(hex, '#000000', t);

    function contrast(a, b) {
      const l1 = Math.max(luminance(a), luminance(b));
      const l2 = Math.min(luminance(a), luminance(b));
      return (l1 + 0.05) / (l2 + 0.05);
    }

    /* ── 六套配色（来自你的色卡） ──────────────────────────────────── */

    const SPECS = [
      {
        id: 'acid', scheme: 'dark',
        zh: '酸夜', en: 'acid night',
        desc: '整屏只有一种荧光，其余全是灰黑。强调色一出现就是最高优先级。',
        bg: '#131313', panel: '#222222', sub: '#1B1B1B', line: '#353535',
        text: '#E9E9E2', dim: '#8D8D83', accent: '#BFFF00', ink: '#12140A',
        ok: '#B7FF07', soft: 0.14,
      },
      {
        id: 'rose-ink', scheme: 'dark',
        zh: '暮玫瑰', en: 'rose ink',
        desc: '墨黑压住玫瑰，低饱和但不廉价。最不像“软件”，像一件用品。',
        bg: '#141414', panel: '#1E1919', sub: '#191515', line: '#342C2C',
        text: '#E9E1DF', dim: '#9A8C8A', accent: '#B76E79', ink: '#150E10',
        ok: '#7FD6A8', soft: 0.2,
      },
      {
        id: 'amber', scheme: 'dark',
        zh: '琥珀夜', en: 'amber night',
        desc: '收起荧光换琥珀。暖光不刺眼，深棕底像老仪表的铜面。',
        bg: '#100C07', panel: '#1A1510', sub: '#141009', line: '#362A1B',
        text: '#F3EADB', dim: '#A08F76', accent: '#FF9E1B', ink: '#1A1004',
        ok: '#8FD16A', soft: 0.2,
      },
      {
        id: 'candy', scheme: 'dark',
        zh: '荧光糖霜', en: 'candy neon',
        desc: '粉和酸绿正面撞。绿压成状态色、粉只留强调位，所以很炸但还能用。',
        bg: '#0E0A10', panel: '#17121A', sub: '#120E15', line: '#2F2334',
        text: '#F4EDF6', dim: '#A392AA', accent: '#F43DDF', ink: '#17061A',
        ok: '#B7FF07', soft: 0.22,
      },
      {
        id: 'paper-lime', scheme: 'light',
        zh: '米纸酸绿', en: 'paper lime',
        desc: '酸夜的白天版。奶白纸底，荧光绿只当色块，字永远压深色。',
        bg: '#F3F0E5', panel: '#FCFBF4', sub: '#EBE6D8', line: '#D8D2BE',
        text: '#1B1B17', dim: '#6D695B', accent: '#BFFF00', ink: '#14160C',
        ok: '#4F6B00', soft: 0.5,
      },
      {
        id: 'rose-dawn', scheme: 'light',
        zh: '晨光玫瑰', en: 'rose dawn',
        desc: '暮玫瑰的白天版。暖白纸配灰玫瑰，强调只出现在按钮和选中项。',
        bg: '#F5EEEB', panel: '#FFFFFF', sub: '#EFE4E0', line: '#DBCBC4',
        text: '#241A1B', dim: '#7C6560', accent: '#A85C66', ink: '#FFF6F4',
        ok: '#3E6B52', soft: 0.24,
      },
    ];

    const BY_ID = new Map(SPECS.map((spec) => [spec.id, spec]));

    /* ── 材质 ─────────────────────────────────────────────────────── */

    const MAT_FIELDS = [
      { key: 'alpha', zh: '面板透明度', unit: '玻璃透过多少底', min: 0.5, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
      { key: 'blur', zh: '背景模糊', unit: 'px（磨砂强度）', min: 0, max: 26, step: 1, fmt: (v) => v + 'px' },
      { key: 'line', zh: '描边厚度', unit: 'px（玻璃边缘）', min: 0, max: 3, step: 0.5, fmt: (v) => v + 'px' },
      { key: 'rad', zh: '圆角', unit: 'px（我们画的容器）', min: 8, max: 24, step: 1, fmt: (v) => v + 'px' },
      { key: 'ear', zh: '猫耳高度', unit: 'px（0 = 关闭）', min: 0, max: 22, step: 1, fmt: (v) => v + 'px' },
    ];

    /* 默认不磨砂：backdrop-filter 落在「背后是正文」的卡片上时，
     * 不是把背景糊掉，而是把正文糊成一片脏斑。要磨砂请自己把「背景模糊」拉起来。 */
    const MAT_DEFAULT = { alpha: 0.92, blur: 0, line: 1, rad: 14, ear: 16 };

    function clampMat(value) {
      const out = {};
      for (const field of MAT_FIELDS) {
        const raw = Number(value && value[field.key]);
        out[field.key] = Number.isFinite(raw) ? Math.min(field.max, Math.max(field.min, raw)) : MAT_DEFAULT[field.key];
      }
      return out;
    }

    /* ── 持久化 ───────────────────────────────────────────────────── */

    function readJson(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        return fallback;
      }
    }

    function writeJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        /* ignore */
      }
    }

    function readStoredTheme() {
      try {
        const id = window.localStorage.getItem(STORE_THEME);
        return id && (BY_ID.has(id) || id === 'custom') ? id : null;
      } catch (error) {
        return null;
      }
    }

    function writeStoredTheme(id) {
      try {
        if (BY_ID.has(id) || id === 'custom') window.localStorage.setItem(STORE_THEME, id);
        else window.localStorage.removeItem(STORE_THEME);
      } catch (error) {
        /* ignore */
      }
    }

    function readStoredBubble() {
      try {
        const id = window.localStorage.getItem(STORE_BUBBLE);
        return id && BUBBLE_IDS.has(id) ? id : 'ear';
      } catch (error) {
        return 'ear';
      }
    }

    function writeStoredBubble(id) {
      try {
        if (BUBBLE_IDS.has(id)) window.localStorage.setItem(STORE_BUBBLE, id);
      } catch (error) {
        /* ignore */
      }
    }

    /* ── 令牌生成 ─────────────────────────────────────────────────── */

    // 把色卡的 7 个值补齐成令牌生成器要的形状
    function normalize(spec) {
      const dark = spec.scheme !== 'light';
      return {
        ...spec,
        dark,
        surface: spec.panel,
        surfaceAlt: spec.sub,
        overlay: dark ? mix(spec.panel, spec.text, 0.06) : spec.panel,
        sidebar: spec.sub,
        textSecondary: spec.dim,
        textTertiary: mix(spec.dim, spec.bg, 0.3),
        line: spec.line,
      };
    }

    function buildTokens(rawSpec, mat) {
      const spec = normalize(rawSpec);
      const dark = spec.dark;
      const ink = (alpha) => rgba(spec.text, alpha);
      const textOnBg = (toward, amount) => mix(spec.text, spec.bg, amount * (toward || 1));
      const danger = dark ? '#FF6F66' : '#B4231C';
      const warn = dark ? '#E8A33D' : '#9A5B00';
      const success = spec.ok || (dark ? '#4ED17E' : '#1B7F45');
      const done = mix(spec.accent, '#7C5CFF', 0.55);
      const toastBg = dark ? mix(spec.panel, spec.text, 0.16) : mix(spec.text, spec.bg, 0.12);
      const tooltipBg = dark ? mix(spec.panel, spec.text, 0.2) : mix(spec.text, spec.bg, 0.08);
      const codeBlock = dark ? mix(spec.bg, '#000000', 0.3) : mix(spec.bg, spec.text, 0.06);
      const codeBanner = dark ? mix(spec.bg, '#000000', 0.16) : mix(spec.bg, spec.text, 0.09);

      // 玻璃：面板类表面按 alpha 变半透明，底下的底色透上来
      const a = mat && Number.isFinite(mat.alpha) ? mat.alpha : 1;
      const glass = (hex, extra) => rgba(hex, Math.max(0.2, Math.min(1, a - (extra || 0))));

      return {
        /* surfaces */
        '--dsw-alias-bg-base': spec.bg,
        '--dsw-alias-bg-document-preview': spec.surfaceAlt,
        '--dsw-alias-bg-document-selection': rgba(spec.accent, 0.34),
        '--dsw-alias-bg-layer-1': glass(spec.surface),
        '--dsw-alias-bg-layer-2': glass(spec.surfaceAlt, 0.04),
        '--dsw-alias-bg-layer-3': glass(spec.surfaceAlt, 0.02),
        '--dsw-alias-bg-mask-1': rgba('#000000', dark ? 0.34 : 0.24),
        '--dsw-alias-bg-mask-2': rgba('#000000', dark ? 0.18 : 0.12),
        '--dsw-alias-bg-mask-3': rgba('#000000', 0.48),
        '--dsw-alias-bg-mask-drop': dark ? rgba('#000000', 0.7) : rgba('#ffffff', 0.7),
        '--dsw-alias-bg-mask-photo': rgba('#000000', 0.88),
        '--dsw-alias-bg-module-platform': glass(spec.surfaceAlt, 0.02),
        '--dsw-alias-bg-multi-select': spec.surfaceAlt,
        '--dsw-alias-bg-overlay': spec.overlay, /* 弹层/设置页永远是实色：半透明的话后面的正文会透上来 */
        '--dsw-alias-bg-skeleton': ink(dark ? 0.08 : 0.06),

        /* borders —— 用色卡给的 line，而不是从文字色推 */
        '--dsw-alias-border-inverted': dark ? ink(0.06) : 'transparent',
        '--dsw-alias-border-inverted2': dark ? ink(0.09) : 'transparent',
        '--dsw-alias-border-l1': spec.line,
        '--dsw-alias-border-l2': dark ? lift(spec.line, 0.1) : shade(spec.line, 0.08),
        '--dsw-alias-border-l2-darkmode-thin': spec.line,
        '--dsw-alias-border-l3': dark ? lift(spec.line, 0.18) : shade(spec.line, 0.16),
        '--dsw-alias-border-l4': dark ? lift(spec.line, 0.28) : shade(spec.line, 0.24),

        /* brand */
        '--dsw-alias-brand-primary': spec.accent,
        '--dsw-alias-brand-primary-invert': spec.text,
        '--dsw-alias-brand-primary-new-colorprimary-new-color': spec.accent,
        '--dsw-alias-brand-text': spec.text,

        /* buttons */
        '--dsw-alias-button-contrast-fill': spec.text,
        '--dsw-alias-button-elevated-fill': glass(spec.surface, 0.02),
        '--dsw-alias-button-floating-fill': glass(spec.surface, 0.02),
        '--dsw-alias-button-floating-hover': spec.surfaceAlt,
        '--dsw-alias-button-ghost-active-border': ink(0.32),
        '--dsw-alias-button-ghost-active-fill': spec.surfaceAlt,
        '--dsw-alias-button-ghost-active-hover': spec.surfaceAlt,
        '--dsw-alias-button-info-fill': spec.accent,
        '--dsw-alias-button-info-hover': dark ? lift(spec.accent, 0.14) : shade(spec.accent, 0.12),
        '--dsw-alias-button-primary-dimmed': spec.surfaceAlt,
        '--dsw-alias-button-primary-fill': spec.text,
        '--dsw-alias-button-primary-hover': dark ? lift(spec.text, 0.12) : shade(spec.text, 0.16),
        '--dsw-alias-button-tool-bar-fill': rgba(spec.surface, 0.72),
        '--dsw-alias-button-tool-bar-fill-invisible': rgba(spec.bg, 0.36),
        '--dsw-alias-button-tool-bar-hover': rgba(spec.surface, 0.92),

        /* diffs */
        '--dsw-alias-code-diff-added': rgba(success, dark ? 0.12 : 0.08),
        '--dsw-alias-code-diff-deleted': rgba(danger, dark ? 0.12 : 0.08),
        '--dsw-alias-file-diff-added-bg': mix(success, spec.bg, dark ? 0.84 : 0.88),
        '--dsw-alias-file-diff-added-gutter': mix(success, spec.bg, dark ? 0.9 : 0.92),
        '--dsw-alias-file-diff-added-marker': success,
        '--dsw-alias-file-diff-deleted-bg': mix(danger, spec.bg, dark ? 0.84 : 0.88),
        '--dsw-alias-file-diff-deleted-gutter': mix(danger, spec.bg, dark ? 0.9 : 0.92),
        '--dsw-alias-file-diff-deleted-marker': danger,

        /* illustrations */
        '--dsw-alias-illustration-background': spec.surfaceAlt,
        '--dsw-alias-illustration-backing': mix(spec.surfaceAlt, spec.text, dark ? 0.1 : 0.06),
        '--dsw-alias-illustration-detail': mix(spec.surfaceAlt, spec.text, dark ? 0.24 : 0.16),
        '--dsw-alias-illustration-inset': spec.surfaceAlt,
        '--dsw-alias-illustration-shadow': spec.surfaceAlt,
        '--dsw-alias-illustration-surface': spec.surface,

        /* interaction */
        '--dsw-alias-interactive-bg-active': ink(dark ? 0.14 : 0.1),
        '--dsw-alias-interactive-bg-hover': ink(dark ? 0.08 : 0.06),
        '--dsw-alias-interactive-bg-hover-accent': rgba(spec.accent, dark ? 0.24 : 0.16),
        '--dsw-alias-interactive-bg-hover-danger': rgba(danger, dark ? 0.16 : 0.1),
        '--dsw-alias-interactive-bg-hover-solid': spec.surfaceAlt,

        /* labels */
        '--dsw-alias-label-caption': mix(spec.dim, spec.bg, 0.24),
        '--dsw-alias-label-deep-diving': spec.accent,
        '--dsw-alias-label-deep-diving-shimmer': rgba(spec.accent, 0.55),
        '--dsw-alias-label-dimmed': textOnBg(1, dark ? 0.42 : 0.3),
        '--dsw-alias-label-document-preview': spec.textSecondary,
        '--dsw-alias-label-primary': spec.text,
        '--dsw-alias-label-primary-bluish': spec.text,
        '--dsw-alias-label-primary-dimmed': textOnBg(1, 0.16),
        '--dsw-alias-label-primary-foreground': spec.ink || readableOn(spec.text),
        '--dsw-alias-label-primary-inverted': spec.bg,
        '--dsw-alias-label-secondary': spec.textSecondary,
        '--dsw-alias-label-shimmer': ink(0.32),
        '--dsw-alias-label-tertiary': spec.textTertiary,
        '--dsw-alias-link': spec.accent,

        /* markdown */
        '--dsw-alias-markdown-citation': spec.surfaceAlt,
        '--dsw-alias-markdown-code-block': codeBlock,
        '--dsw-alias-markdown-code-block-banner': codeBanner,
        '--dsw-alias-markdown-code-segment-selected': spec.surface,
        '--dsw-alias-markdown-code-segment-unselected': spec.surfaceAlt,
        '--dsw-alias-markdown-inline-code': mix(spec.bg, spec.text, dark ? 0.1 : 0.05),
        '--dsw-alias-markdown-placeholder': spec.surfaceAlt,
        '--dsw-alias-markdown-tag': spec.surfaceAlt,
        '--dsw-alias-menu-group-header-fill': rgba(spec.surface, 0.94),
        '--dsw-alias-menu-icon': spec.textSecondary,

        /* scrollbars */
        '--dsw-alias-scrollbar-bg-l1': ink(dark ? 0.16 : 0.12),
        '--dsw-alias-scrollbar-bg-l2': ink(dark ? 0.22 : 0.18),
        '--dsw-alias-scrollbar-hover-l1': ink(dark ? 0.28 : 0.24),
        '--dsw-alias-scrollbar-hover-l2': ink(dark ? 0.36 : 0.32),

        /* states */
        '--dsw-alias-state-business-primary': spec.accent,
        '--dsw-alias-state-business-tertiary': rgba(spec.accent, dark ? 0.2 : 0.14),
        '--dsw-alias-state-done-primary': done,
        '--dsw-alias-state-error-primary': danger,
        '--dsw-alias-state-error-secondary': mix(danger, '#ffffff', 0.28),
        '--dsw-alias-state-idle-primary': ink(dark ? 0.24 : 0.2),
        '--dsw-alias-state-success-primary': success,
        '--dsw-alias-state-success-secondary': mix(success, '#ffffff', 0.26),
        '--dsw-alias-state-success-tertiary': rgba(success, dark ? 0.18 : 0.14),
        '--dsw-alias-state-warn-label': warn,
        '--dsw-alias-state-warn-primary': warn,
        '--dsw-alias-state-warn-secondary': mix(warn, '#ffffff', 0.26),
        '--dsw-alias-state-warn-tertiary': rgba(warn, dark ? 0.18 : 0.14),

        /* chrome */
        '--dsw-alias-switch-thumb': dark ? mix(spec.text, spec.bg, 0.25) : '#ffffff',
        '--dsw-alias-toast-bg': toastBg,
        '--dsw-alias-toast-label': '#ffffff',
        '--dsw-alias-tooltip-bg': tooltipBg,
        '--dsw-alias-tooltip-key-bg': rgba('#ffffff', 0.18),
        '--dsw-alias-turn-trigger-bg': spec.surfaceAlt,
        '--dsw-alias-turn-trigger-bg-hover': ink(0.08),

        /* product surfaces —— 气泡用强调色低透明度，这就是“猫耳”和气泡本身的颜色 */
        '--dsw-specific-bubble': rgba(spec.accent, spec.soft != null ? spec.soft : 0.14),
        '--dsw-specific-bubble-highlight': rgba(spec.accent, (spec.soft != null ? spec.soft : 0.14) * 1.8),
        /* 气泡是实色：猫耳要和泡体融成一个轮廓，半透明会在接缝处叠出第二条边 */
        '--dsk-bubble-fill': dark
          ? mix(spec.bg, spec.accent, spec.soft != null ? spec.soft : 0.14)
          : mix(spec.panel, spec.accent, Math.min(0.42, (spec.soft != null ? spec.soft : 0.14) * 2.2)),
        /* 气泡描边样式用的几档强调色透明度 */
        '--dsk-accent': spec.accent,
        '--dsk-accent-60': rgba(spec.accent, dark ? 0.62 : 0.72),
        '--dsk-accent-35': rgba(spec.accent, 0.35),
        '--dsk-accent-28': rgba(spec.accent, 0.28),
        '--dsk-accent-22': rgba(spec.accent, 0.22),
        '--dsk-accent-10': rgba(spec.accent, dark ? 0.1 : 0.14),
        '--dsw-specific-input-major': glass(spec.surface, 0.02),
        '--dsw-specific-login-input': spec.surfaceAlt,
        '--dsw-specific-menu': glass(spec.overlay, 0.02),
        '--dsw-specific-selector': spec.surfaceAlt,
        '--dsw-specific-sidebar-fill': spec.sidebar,
        '--dsw-specific-sidebar-nav-item-active': mix(spec.sidebar, spec.text, dark ? 0.1 : 0.06),
        '--dsw-specific-sidebar-nav-item-active-accent': rgba(spec.accent, dark ? 0.22 : 0.18),
        '--dsw-specific-tip': spec.surfaceAlt,
      };
    }

    /* ── 玻璃 + 猫耳：全局样式 ────────────────────────────────────── */

    /* 玻璃选择器是整个插件最脆的一处 —— CSS Modules 的类名是 `_card_ab12cd_1` 这种形状，
     * DSH 一升级名称就可能变。所以集中写在这里，并且运行时做命中检查（glassHits）：
     * 命中为 0 就在设置页明说「没匹配到界面元素」，而不是悄悄失效、让人以为是坏了。
     *
     * 还要当心：`_panel` 这类名字会匹配到整块消息区。给它加 backdrop-filter 的后果不是「模糊背景」，
     * 而是把背后的正文糊掉一大片（关掉侧边栏、内容区变宽时最明显）。
     * 所以候选元素要过一道尺寸筛：只有「卡片大小」的才真的穿玻璃，见 refreshGlass()。 */
    const GLASS_CANDIDATES = [
      '[class*="_card"]',
      '[class*="_panel"]',
      '[class*="_dock"]',
      '[class*="_composerCard"]',
      '[class*="_modal"]',
    ];
    const GLASS_MAX_AREA = 0.22; // 占视口面积超过 22% 的一律不给玻璃
    const GLASS_MAX_EDGE = 0.62; // 任一边超过视口 62% 的也不要（整块内容区、分栏、整页弹窗）
    const GLASS_MIN_ALPHA = 0.15; // 自己压根没画底色的（透明容器）不给，否则只剩一片糊

    function coreCss(blurPx) {
      const frosted = Number(blurPx) > 0;
      const glassRule = frosted
        ? `backdrop-filter: blur(var(--dsk-blur)) saturate(150%);
           -webkit-backdrop-filter: blur(var(--dsk-blur)) saturate(150%);`
        : `/* 磨砂关掉了：只留半透明底 + 一圈发丝边，不糊背后的正文 */`;
      return `
      :root{
        --dsk-blur: ${Number(blurPx) > 0 ? Number(blurPx) : 0}px;
        --dsk-line: 1px;
        --dsk-rad: 14px;
        --dsk-ear: 16px;
        --dsk-glass-line: rgba(255,255,255,.09);
        --dsk-glass-shadow: 0 6px 24px rgba(0,0,0,.28);
      }

      /* 只有被 refreshGlass() 打上 data-dsk-glass="1" 的小卡片才穿玻璃 */
      [data-dsk-glass="1"] {
        ${glassRule}
        outline: var(--dsk-line) solid var(--dsk-glass-line);
        outline-offset: calc(-1 * var(--dsk-line));
        border-radius: var(--dsk-rad);
      }

      /* 气泡的外观由 BUBBLE_STYLES 决定，这里只放所有样式共用的定位基础 */
      [data-message-bubble]{
        position: relative;
        overflow: visible;
      }
      @media (prefers-reduced-motion: reduce){
        [data-message-bubble]{ transition: none !important; }
      }
    `;
    }

    /* 只认「自己画了底色」的元素：透明容器套 backdrop-filter 等于把背后的正文糊成一片 */
    function paintedAlpha(node) {
      try {
        const style = window.getComputedStyle(node);
        const bg = style && style.backgroundColor;
        if (!bg || bg === 'transparent') return 0;
        const match = /rgba?\(([^)]+)\)/.exec(bg);
        if (!match) return 0;
        const parts = match[1].split(',');
        if (parts.length < 4) return 1;
        const alpha = parseFloat(parts[3]);
        return Number.isFinite(alpha) ? alpha : 1;
      } catch (error) {
        return 0;
      }
    }

    /* 按实际尺寸决定谁穿玻璃：卡片大小才给，整块内容区一律不给 */
    function refreshGlass() {
      if (typeof document === 'undefined' || !document.body) return 0;
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      if (!vw || !vh) return 0;
      const maxArea = vw * vh * GLASS_MAX_AREA;
      const maxW = vw * GLASS_MAX_EDGE;
      const maxH = vh * GLASS_MAX_EDGE;
      let hits = 0;
      for (const selector of GLASS_CANDIDATES) {
        let nodes = [];
        try {
          nodes = document.querySelectorAll(selector);
        } catch (error) {
          continue;
        }
        for (const node of nodes) {
          let rect = null;
          try {
            rect = node.getBoundingClientRect();
          } catch (error) {
            continue;
          }
          if (!rect || !rect.width || !rect.height) continue;
          const small =
            rect.width * rect.height <= maxArea && rect.width <= maxW && rect.height <= maxH;
          const painted = small && paintedAlpha(node) >= GLASS_MIN_ALPHA;
          node.setAttribute('data-dsk-glass', painted ? '1' : '0');
          if (painted) hits += 1;
        }
      }
      return hits;
    }

    /* 玻璃是否真的套上了：0 表示选择器已经和当前版本对不上 */
    function glassHits() {
      if (typeof document === 'undefined') return 0;
      try {
        return document.querySelectorAll('[data-dsk-glass="1"]').length;
      } catch (error) {
        return 0;
      }
    }


    /* ── 气泡样式（可在设置页切换） ──────────────────────────────── */

    const STORE_BUBBLE = 'moodtone:bubble';
    const BUBBLE_CSS_ID = 'moodtone-bubble-css';

    const BUBBLE_STYLES = [
      { id: 'ear', zh: '猫耳', en: 'cat ears' },
      { id: 'fbox', zh: '细框', en: 'thin frame' },
      { id: 'oval', zh: '圆角框', en: 'pill frame' },
      { id: 'double', zh: '双层框', en: 'double frame' },
      { id: 'shadow', zh: '浮起', en: 'lifted' },
      { id: 'tint', zh: '淡底', en: 'tinted' },
      { id: 'tilt', zh: '歪头', en: 'tilted' },
    ];
    const BUBBLE_IDS = new Set(BUBBLE_STYLES.map((style) => style.id));

    /* 猫耳：耳朵和泡体是同一个轮廓、同一种实色，接缝靠 7px 重叠吃掉 */
    const EAR_CSS = `
      [data-message-bubble]{
        background: var(--dsk-bubble-fill, var(--dsw-specific-bubble));
        border-radius: var(--dsk-rad);
        outline: var(--dsk-line) solid var(--dsk-glass-line);
        outline-offset: calc(-1 * var(--dsk-line));
      }
      [data-message-bubble]::before,
      [data-message-bubble]::after{
        content: "";
        position: absolute;
        top: calc(1px - var(--dsk-ear));
        width: calc(var(--dsk-ear) * 1.15);
        height: calc(var(--dsk-ear) + 7px);
        background: var(--dsk-bubble-fill, var(--dsw-specific-bubble));
        pointer-events: none;
        z-index: 0;
      }
      [data-message-bubble]::after{ left: 0; clip-path: polygon(0 100%, 42% 0, 100% 100%); }
      [data-message-bubble]::before{ right: 0; clip-path: polygon(0 100%, 58% 0, 100% 100%); }
    `;

    function bubbleCss(id) {
      const base = `[data-message-bubble]{ border-radius: var(--dsk-rad); transition: border-color .18s ease, box-shadow .18s ease; }`;
      switch (id) {
        case 'fbox':
          return base + `[data-message-bubble]{ background: transparent; border: 1px solid var(--dsk-accent-60); border-radius: 6px; }`;
        case 'oval':
          return base + `[data-message-bubble]{ background: transparent; border: 1px solid var(--dsk-accent-60); border-radius: 999px; }`;
        case 'double':
          return base + `[data-message-bubble]{ background: transparent; border: 1px solid var(--dsk-accent-60); border-radius: 6px; outline: 1px solid var(--dsk-accent-35); outline-offset: -4px; }`;
        case 'shadow':
          return base + `[data-message-bubble]{ background: transparent; border: 1px solid var(--dsk-accent-60); border-radius: 6px; box-shadow: 3px 3px 0 var(--dsk-accent-22); }`;
        case 'tint':
          return base + `[data-message-bubble]{ background: var(--dsk-accent-10); border: 1px solid var(--dsk-accent-28); border-radius: 10px; }`;
        case 'tilt':
          return base + EAR_CSS + `[data-message-bubble]{ transform: rotate(-1.4deg); transform-origin: 100% 100%; }`;
        case 'ear':
        default:
          return base + EAR_CSS;
      }
    }

    function applyBubbleCss(id) {
      if (typeof document === 'undefined') return;
      let tag = document.getElementById(BUBBLE_CSS_ID);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = BUBBLE_CSS_ID;
        tag.dataset.plugin = 'moodtone';
        document.head.appendChild(tag);
      }
      tag.textContent = bubbleCss(BUBBLE_IDS.has(id) ? id : 'ear');
    }

    function removeBubbleCss() {
      if (typeof document === 'undefined') return;
      const tag = document.getElementById(BUBBLE_CSS_ID);
      if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
    }

    function applyMaterialCss(mat) {
      if (typeof document === 'undefined') return;
      let tag = document.getElementById(CSS_ID);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = CSS_ID;
        tag.dataset.plugin = 'moodtone';
        document.head.appendChild(tag);
      }
      const ear = mat.ear > 0 ? mat.ear : 0;
      tag.textContent =
        coreCss(mat.blur) +
        `
        :root{
          --dsk-blur: ${mat.blur > 0 ? mat.blur : 0}px;
          --dsk-line: ${mat.line}px;
          --dsk-rad: ${mat.rad}px;
          --dsk-ear: ${ear}px;
        }
        `;
    }

    function removeMaterialCss() {
      if (typeof document === 'undefined') return;
      const tag = document.getElementById(CSS_ID);
      if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
    }

    /* ── 文案 ─────────────────────────────────────────────────────── */

    const DICTS = {
      zh: {
        section: '配色方案',
        hint: '选一套直接用；下面可以改任意一个颜色，并调玻璃质感。色值保存在本地，重开还在。',
        material: '材质',
        colors: '颜色 · 全局',
        custom: '我的配色',
        pick: '当前',
        resetTheme: '回到默认',
        export: '导出这套设置',
        resetMat: '材质复原',
        contrastGood: '对比度',
        earOff: '猫耳已关闭',
        bubble: '气泡样式',
        bubbleNote: '气泡是原生的那个 div，只换外观：细框/圆角框来自 LaTeX 的 fbox、ovalbox，双层框和浮起来自 doublebox、shadowbox。选中的样式记在本地，刷新还在。',
        glassNote: '透明度与模糊只影响“卡片类”（气泡、卡片、面板、输入框）；边框与圆角只作用于我们画的那层。',
        overrideNote: '主题被别的配置层改回去了（比如某个预设把 ui-theme 钉在浅色）。点一下重新应用。',
        reassert: '重新应用',
        glassMiss: '玻璃命中 0 个元素 —— 这个 DSH 版本的类名大概变了。配色和气泡仍然可用。',
        crashTitle: '这个面板没能渲染出来',
        crashBody: '设置页其它部分不受影响。通常把主题复位就能恢复。',
        crashReset: '把主题复位到默认',
      },
      en: {
        section: 'Color themes',
        hint: 'Pick one, or edit any single color below and tune the glass.',
        material: 'Material',
        colors: 'Colors · global',
        custom: 'My palette',
        pick: 'Active',
        resetTheme: 'Back to default',
        export: 'Export this setup',
        resetMat: 'Reset material',
        contrastGood: 'contrast',
        earOff: 'Cat ears off',
        bubble: 'Bubble style',
        bubbleNote: 'The bubble is the native div; these presets only change its look — thin and pill frames from LaTeX fbox/ovalbox, double frame and lift from doublebox/shadowbox. The choice is stored locally.',
        glassNote: 'Alpha and blur affect cards only; ring and radius apply to our own layer.',
        overrideNote: 'The theme was reset by another config layer (e.g. a preset pinning ui-theme). Click to re-apply.',
        reassert: 'Re-apply',
        glassMiss: 'Glass matched 0 elements — the class names of this DSH build probably changed. Colors and bubbles still work.',
        crashTitle: 'This panel failed to render',
        crashBody: 'The rest of Settings is unaffected. Resetting the theme usually fixes it.',
        crashReset: 'Reset to default theme',
      },
    };

    let sharedI18n = null;
    let sharedSkin = null;

    function currentLang() {
      try {
        const snapshot = sharedI18n && sharedI18n.getSnapshot();
        const active = snapshot && snapshot.active;
        return typeof active === 'string' && active.indexOf('zh') === 0 ? 'zh' : 'en';
      } catch (error) {
        return 'zh';
      }
    }

    function textFor(key) {
      const lang = currentLang();
      const dict = DICTS[lang] || DICTS.zh;
      return dict[key] != null ? dict[key] : (DICTS.zh[key] != null ? DICTS.zh[key] : key);
    }

    /* ── 设置页 ───────────────────────────────────────────────────── */

    const PANEL_CSS = `
      .dsk-wrap{display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary)}
      .dsk-hint{margin:0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}
      .dsk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}
      .dsk-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:12px;
        border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);cursor:pointer;
        text-align:left;font:inherit;color:inherit;transition:border-color .15s ease,transform .15s ease}
      .dsk-card:hover{transform:translateY(-1px);border-color:var(--dsw-alias-border-l3)}
      .dsk-card[data-active="true"]{border-color:var(--dsw-alias-state-business-primary);
        box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary) inset}
      .dsk-prev{height:52px;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;gap:4px;padding:6px}
      .dsk-bar{height:8px;border-radius:4px;width:70%}
      .dsk-dot{width:12px;height:12px;border-radius:50%;margin-top:auto}
      .dsk-name{font-size:12px;font-weight:600}
      .dsk-en{font-size:10px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,Consolas,monospace}
      .dsk-desc{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);margin:0}
      .dsk-badge{position:absolute;top:8px;right:8px;font-size:9px;padding:1px 5px;border-radius:999px;
        background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-foreground)}
      .dsk-block{display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}
      .dsk-title{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
      .dsk-row{display:flex;align-items:center;gap:10px}
      .dsk-row .lbl{font-size:12px;width:92px;flex:none;color:var(--dsw-alias-label-secondary)}
      .dsk-row input[type=color]{width:34px;height:22px;padding:0;border:1px solid var(--dsw-alias-border-l2);
        border-radius:5px;background:none;cursor:pointer}
      .dsk-row .hex{font-size:11px;font-family:ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-tertiary)}
      .dsk-ratio{font-size:10px;font-family:ui-monospace,Consolas,monospace;padding:1px 5px;border-radius:4px;
        background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}
      .dsk-ratio[data-bad="true"]{color:var(--dsw-alias-state-error-primary)}
      .dsk-slider{display:flex;align-items:center;gap:10px}
      .dsk-slider input[type=range]{flex:1;accent-color:var(--dsw-alias-state-business-primary)}
      .dsk-slider .v{width:56px;text-align:right;font-size:11px;font-family:ui-monospace,Consolas,monospace;
        color:var(--dsw-alias-label-tertiary)}
      .dsk-acts{display:flex;gap:8px;flex-wrap:wrap}
      .dsk-btn{font:inherit;font-size:12px;padding:6px 11px;border-radius:8px;cursor:pointer;
        border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
      .dsk-btn:hover{border-color:var(--dsw-alias-border-l3)}
      .dsk-warn{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11.5px;line-height:1.5;
        padding:8px 10px;border-radius:9px;color:var(--dsw-alias-state-warn-primary);
        border:1px solid var(--dsw-alias-state-warn-primary);background:var(--dsw-alias-bg-layer-1)}
      .dsk-crash{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;
        border:1px solid var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-1)}
      .dsk-crash code{font-size:11px;font-family:ui-monospace,Consolas,monospace;
        color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;word-break:break-word}
      .dsk-out{width:100%;min-height:74px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);
        background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);
        font-family:ui-monospace,Consolas,monospace;font-size:10.5px;line-height:1.5;padding:8px 9px;resize:vertical}
      .dsk-note{font-size:11px;line-height:1.6;color:var(--dsw-alias-label-tertiary);margin:0}
      .dsk-chips{display:flex;flex-wrap:wrap;gap:6px}
      .dsk-chip{font:inherit;font-size:12px;padding:5px 12px;border-radius:999px;cursor:pointer;
        border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
        color:var(--dsw-alias-label-secondary);transition:border-color .15s ease,color .15s ease}
      .dsk-chip:hover{border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}
      .dsk-chip[data-active="true"]{border-color:var(--dsw-alias-state-business-primary);
        color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary)}
    `;

    const COLOR_FIELDS = [
      { key: 'bg', zh: '底色', en: 'bg' },
      { key: 'panel', zh: '面板', en: 'panel' },
      { key: 'sub', zh: '次级面板', en: 'sub' },
      { key: 'line', zh: '边框', en: 'line' },
      { key: 'text', zh: '主文字', en: 'text' },
      { key: 'dim', zh: '次文字', en: 'dim' },
      { key: 'accent', zh: '强调色', en: 'accent' },
      { key: 'ink', zh: '强调色上的字', en: 'ink' },
    ];

    const CONTRAST_RULES = { text: 4.5, dim: 4.5, accent: 3, ink: 3 };

    function PaletteSection() {
      const [, force] = React.useState(0);
      const bump = React.useCallback(() => force((n) => n + 1), []);

      React.useEffect(() => {
        if (!sharedSkin) return undefined;
        return sharedSkin.subscribe(bump);
      }, [bump]);

      const state = sharedSkin
        ? sharedSkin.getState()
        : { theme: DEFAULT_THEME, mat: MAT_DEFAULT, custom: BY_ID.get(DEFAULT_THEME), bubble: 'ear' };
      // 取色器显示的是“当前正在用的那套”的值：改一下就从它派生“我的配色”
      const spec = (state.theme !== 'custom' && BY_ID.get(state.theme)) || state.custom;
      const inkOn = spec.accent;

      const setColor = (key, value) => {
        if (!sharedSkin) return;
        sharedSkin.setCustomColor(key, value);
        bump();
      };

      const setMat = (key, value) => {
        if (!sharedSkin) return;
        sharedSkin.setMaterial(key, value);
        bump();
      };

      return h(
        'div',
        { className: 'dsk-wrap' },
        h('style', { key: 'css' }, PANEL_CSS),
        h('p', { className: 'dsk-hint', key: 'hint' }, textFor('hint')),

        // 主题被别的配置层覆盖时，明说 + 一键重设，而不是偷偷重试
        state.overridden
          ? h(
              'div',
              { className: 'dsk-warn', key: 'override' },
              h('span', null, textFor('overrideNote')),
              h(
                'button',
                {
                  className: 'dsk-btn',
                  type: 'button',
                  onClick: () => {
                    if (sharedSkin) sharedSkin.reassert();
                    bump();
                  },
                },
                textFor('reassert'),
              ),
            )
          : null,

        // 玻璃选择器没匹配到任何元素 = 这个 DSH 版本的类名变了
        state.glass === 0
          ? h('div', { className: 'dsk-warn', key: 'glass' }, textFor('glassMiss'))
          : null,

        h(
          'div',
          { className: 'dsk-grid', key: 'grid' },
          SPECS.map((item) =>
            h(
              'button',
              {
                key: item.id,
                className: 'dsk-card',
                type: 'button',
                'data-active': state.theme === item.id ? 'true' : 'false',
                onClick: () => {
                  if (sharedSkin) sharedSkin.setTheme(item.id);
                  bump();
                },
              },
              h(
                'div',
                { className: 'dsk-prev', style: { background: item.bg, border: `1px solid ${item.line}` } },
                h('div', { className: 'dsk-bar', style: { background: item.panel } }),
                h('div', { className: 'dsk-bar', style: { background: item.sub, width: '45%' } }),
                h('div', { className: 'dsk-dot', style: { background: item.accent } }),
              ),
              h('div', { className: 'dsk-name' }, currentLang() === 'zh' ? item.zh : item.en),
              h('div', { className: 'dsk-en' }, item.en),
              state.theme === item.id ? h('span', { className: 'dsk-badge' }, textFor('pick')) : null,
            ),
          ),
        ),

        h(
          'div',
          { className: 'dsk-block', key: 'colors' },
          h('div', { className: 'dsk-title' }, textFor('colors')),
          h(
            'div',
            { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '6px 18px' } },
            COLOR_FIELDS.map((field) => {
              const value = spec[field.key];
              const need = CONTRAST_RULES[field.key];
              // “强调色上的字”要和强调色比，不是和底色比
              const value2 = need ? contrast(value, field.key === 'ink' ? inkOn : spec.bg) : null;
              return h(
                'div',
                { className: 'dsk-row', key: field.key },
                h('span', { className: 'lbl' }, currentLang() === 'zh' ? field.zh : field.en),
                h('input', {
                  type: 'color',
                  value,
                  onChange: (event) => setColor(field.key, event.target.value),
                }),
                h('span', { className: 'hex' }, value),
                value2 == null
                  ? null
                  : h(
                      'span',
                      { className: 'dsk-ratio', 'data-bad': value2 < need ? 'true' : 'false' },
                      value2.toFixed(1) + ':1',
                    ),
              );
            }),
          ),
        ),

        h(
          'div',
          { className: 'dsk-block', key: 'bubble' },
          h('div', { className: 'dsk-title' }, textFor('bubble')),
          h(
            'div',
            { className: 'dsk-chips' },
            BUBBLE_STYLES.map((style) =>
              h(
                'button',
                {
                  key: style.id,
                  className: 'dsk-chip',
                  type: 'button',
                  'data-active': state.bubble === style.id ? 'true' : 'false',
                  onClick: () => {
                    if (sharedSkin) sharedSkin.setBubble(style.id);
                    bump();
                  },
                },
                currentLang() === 'zh' ? style.zh : style.en,
              ),
            ),
          ),
          h('p', { className: 'dsk-note' }, textFor('bubbleNote')),
        ),

        h(
          'div',
          { className: 'dsk-block', key: 'material' },
          h('div', { className: 'dsk-title' }, textFor('material')),
          MAT_FIELDS.map((field) =>
            h(
              'div',
              { className: 'dsk-slider', key: field.key },
              h('span', { className: 'lbl' }, field.zh),
              h('input', {
                type: 'range',
                min: field.min,
                max: field.max,
                step: field.step,
                value: state.mat[field.key],
                onChange: (event) => setMat(field.key, Number(event.target.value)),
              }),
              h('span', { className: 'v' }, field.fmt(state.mat[field.key])),
            ),
          ),
          h('p', { className: 'dsk-note' }, textFor('glassNote')),
        ),

        h(
          'div',
          { className: 'dsk-acts', key: 'acts' },
          h(
            'button',
            {
              className: 'dsk-btn',
              type: 'button',
              onClick: () => {
                if (sharedSkin) sharedSkin.setTheme(DEFAULT_THEME);
                bump();
              },
            },
            textFor('resetTheme'),
          ),
          h(
            'button',
            {
              className: 'dsk-btn',
              type: 'button',
              onClick: () => {
                if (sharedSkin) sharedSkin.resetMaterial();
                bump();
              },
            },
            textFor('resetMat'),
          ),
          h(
            'button',
            {
              className: 'dsk-btn',
              type: 'button',
              onClick: () => {
                if (!sharedSkin) return;
                const text = sharedSkin.exportText();
                const box = document.getElementById('dsk-out');
                if (box) {
                  box.value = text;
                  box.focus();
                  box.select();
                }
              },
            },
            textFor('export'),
          ),
        ),
        h('textarea', { className: 'dsk-out', id: 'dsk-out', key: 'out', readOnly: true, placeholder: '…' }),
      );
    }

    /* 面板的错误边界：一个组件抛错会 blank 掉整个 slot，上线前必须兜住 */
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error) {
        return { error: String((error && error.message) || error || 'unknown error') };
      }

      render() {
        if (this.state.error == null) return this.props.children;
        return h(
          'div',
          { className: 'dsk-crash' },
          h('strong', null, textFor('crashTitle')),
          h('p', { className: 'dsk-hint' }, textFor('crashBody')),
          h('code', null, this.state.error),
          h(
            'button',
            {
              className: 'dsk-btn',
              type: 'button',
              onClick: () => {
                try {
                  if (sharedSkin) sharedSkin.setTheme('light');
                } catch (error) {
                  /* ignore */
                }
                this.setState({ error: null });
              },
            },
            textFor('crashReset'),
          ),
        );
      }
    }

    function PanelSafe(props) {
      return h(PanelBoundary, null, h(PaletteSection, props));
    }

    /* ── 插件入口 ─────────────────────────────────────────────────── */

    function apply(ctx) {
      // 生存计数：热重载会连着 dispose + apply，靠它区分「换了个实例」和「真的被卸载」
      try {
        window[LIFE_KEY] = (window[LIFE_KEY] || 0) + 1;
      } catch (error) {
        /* ignore */
      }

      // 文案
      ctx.effect(() => {
        const bind = (localeId, dict) => {
          try {
            ctx.locale.register(NS, localeId, dict);
          } catch (error) {
            /* 已注册 */
          }
        };
        bind('zh', DICTS.zh);
        bind('zh-CN', DICTS.zh);
        bind('zh-Hans', DICTS.zh);
        bind('zh-TW', DICTS.zh);
        bind('en', DICTS.en);
        bind('en-US', DICTS.en);
        return () => {};
      }, 'moodtone: locale dictionaries');

      const locale = ctx.get('locale');
      if (locale) {
        sharedI18n = {
          getSnapshot: () => locale.getSnapshot(),
          subscribe: (fn) => locale.subscribe(fn),
          bind: (ns) => locale.bind(ns),
        };
      }

      const theme = ctx.get('theme');
      if (!theme) return;

      let mat = clampMat(readJson(STORE_MAT, MAT_DEFAULT));
      let customSpec = Object.assign({}, BY_ID.get(DEFAULT_THEME), readJson(STORE_CUSTOM, {}));
      customSpec.id = 'custom';
      let activeId = readStoredTheme() || DEFAULT_THEME;
      let bubbleId = readStoredBubble();
      let overridden = false;
      const disposers = new Map();
      const listeners = new Set();
      const notify = () => {
        for (const listener of listeners) {
          try {
            listener();
          } catch (error) {
            /* 一个订阅者炸了不该影响别人 */
          }
        }
      };

      applyMaterialCss(mat);
      applyBubbleCss(bubbleId);

      /* 给「卡片大小」的元素打玻璃标记；布局变了（开关侧边栏、切换会话、窗口缩放）就重算。
       * 只监听 childList，不监听 attributes —— 我们写的就是 attribute，监听会自己触发自己。 */
      ctx.effect(() => {
        if (typeof document === 'undefined') return () => {};
        let timer = 0;
        const run = () => {
          timer = 0;
          refreshGlass();
        };
        const schedule = () => {
          if (timer) return;
          timer = setTimeout(run, 320);
        };
        refreshGlass();
        let observer = null;
        try {
          observer = new MutationObserver(schedule);
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (error) {
          observer = null;
        }
        window.addEventListener('resize', schedule);
        return () => {
          if (timer) clearTimeout(timer);
          if (observer) observer.disconnect();
          window.removeEventListener('resize', schedule);
          try {
            for (const node of document.querySelectorAll('[data-dsk-glass]')) {
              node.removeAttribute('data-dsk-glass');
            }
          } catch (error) {
            /* ignore */
          }
        };
      }, 'moodtone: glass targeting');

      const registerAll = () => {
        for (const spec of SPECS) {
          const dispose = disposers.get(spec.id);
          if (dispose) {
            try {
              dispose();
            } catch (error) {
              /* ignore */
            }
            disposers.delete(spec.id);
          }
          try {
            disposers.set(
              spec.id,
              theme.register({
                id: regId(spec.id),
                colorScheme: spec.scheme,
                tokens: buildTokens(spec, mat),
              }),
            );
          } catch (error) {
            /* 已存在同名主题：忽略 */
          }
        }
        const disposeCustom = disposers.get('custom');
        if (disposeCustom) {
          try {
            disposeCustom();
          } catch (error) {
            /* ignore */
          }
          disposers.delete('custom');
        }
        try {
          disposers.set(
            'custom',
            theme.register({
              id: regId('custom'),
              colorScheme: customSpec.scheme,
              tokens: buildTokens(customSpec, mat),
            }),
          );
        } catch (error) {
          /* ignore */
        }
      };

      const activate = (id) => {
        activeId = id;
        try {
          theme.setTheme(regId(id));
        } catch (error) {
          /* ignore */
        }
        writeStoredTheme(id);
      };

      registerAll();

      // 首次进入 / 页面重载后把用户选的（或默认的）那套抢回来
      ctx.effect(() => {
        const timers = [260, 900, 2200].map((delay) =>
          setTimeout(() => {
            if (activeId && activeId !== 'light' && activeId !== 'dark') activate(activeId);
          }, delay),
        );
        // 抢完之后核对一次：如果 preference 还是不是我们的，说明被配置层覆盖了。
        // 这时不硬抢，而是把事实挂到 state 上，让面板明说（见 override 提示）。
        const watch = setTimeout(() => {
          let preference = '';
          try {
            const snapshot = theme.getTheme();
            preference = (snapshot && snapshot.preference) || '';
          } catch (error) {
            /* ignore */
          }
          overridden = Boolean(preference) && preference !== regId(activeId);
          if (overridden) notify();
        }, 2800);
        return () => {
          timers.forEach((timer) => clearTimeout(timer));
          clearTimeout(watch);
        };
      }, 'moodtone: re-assert chosen theme');

      sharedSkin = {
        subscribe(listener) {
          listeners.add(listener);
          let off = null;
          try {
            off = ctx.on('theme/change', () => listener());
          } catch (error) {
            /* ignore */
          }
          return () => {
            listeners.delete(listener);
            if (off) off();
          };
        },
        getState() {
          return { theme: activeId, mat, custom: customSpec, bubble: bubbleId, overridden, glass: glassHits() };
        },
        reassert() {
          overridden = false;
          registerAll();
          activate(activeId);
          notify();
        },
        setBubble(id) {
          if (!BUBBLE_IDS.has(id)) return;
          bubbleId = id;
          writeStoredBubble(id);
          applyBubbleCss(id);
          notify();
        },
        setTheme(id) {
          if (!BY_ID.has(id) && id !== 'custom') return;
          if (id === 'custom') registerAll();
          overridden = false;
          activate(id);
          notify();
        },
        setCustomColor(key, value) {
          // 从“当前这套”派生：在酸夜上改一个色 → 变成“我的配色”
          const base = activeId !== 'custom' && BY_ID.get(activeId) ? BY_ID.get(activeId) : customSpec;
          customSpec = Object.assign({}, base, { [key]: value, id: 'custom' });
          writeJson(STORE_CUSTOM, {
            bg: customSpec.bg,
            panel: customSpec.panel,
            sub: customSpec.sub,
            line: customSpec.line,
            text: customSpec.text,
            dim: customSpec.dim,
            accent: customSpec.accent,
            ink: customSpec.ink,
          });
          // 从当前这套起改：把 scheme 跟着底色亮度走
          customSpec.scheme = luminance(customSpec.bg) > 0.4 ? 'light' : 'dark';
          customSpec.ok = customSpec.scheme === 'light' ? '#4F6B00' : '#B7FF07';
          registerAll();
          activate('custom');
        },
        setMaterial(key, value) {
          mat = clampMat(Object.assign({}, mat, { [key]: value }));
          writeJson(STORE_MAT, mat);
          applyMaterialCss(mat);
          registerAll();
          if (activeId) activate(activeId);
        },
        resetMaterial() {
          mat = clampMat(MAT_DEFAULT);
          writeJson(STORE_MAT, mat);
          applyMaterialCss(mat);
          registerAll();
          if (activeId) activate(activeId);
        },
        exportText() {
          const colors = COLOR_FIELDS.map((field) => `  ${field.en}: '${customSpec[field.key]}',`).join('\n');
          const mats = MAT_FIELDS.map((field) => `  ${field.key}: ${mat[field.key]},   /* ${field.zh} */`).join('\n');
          return (
            '// 颜色 → theme.register\n' +
            '{ id: \'custom\', scheme: \'' + customSpec.scheme + '\', tokens: {\n' + colors + '\n} }\n\n' +
            '// 材质 → 全局 CSS 变量\n{\n' + mats + '\n}\n\n' +
            '// 气泡样式\n{ bubble: \'' + bubbleId + '\' }'
          );
        },
      };

      ctx.effect(() => () => {
        removeMaterialCss();
        removeBubbleCss();
        for (const dispose of disposers.values()) {
          try {
            dispose();
          } catch (error) {
            /* ignore */
          }
        }
        disposers.clear();
        listeners.clear();
        sharedSkin = null;

        /* 卸载前把主题偏好复位。
         * 不复位的话 preference 会指向一个已经注销的 id，DSH 拿到空主题 —— 轻则闪回默认，重则白屏。
         * 但热重载也会走这里，所以先看生存计数：只有当没有新实例接上（= 真的被卸载/禁用）才复位。 */
        const myLife = window[LIFE_KEY];
        setTimeout(() => {
          if (window[LIFE_KEY] !== myLife) return; // 有新实例接管，别动
          let preference = '';
          try {
            const snapshot = theme.getTheme();
            preference = (snapshot && snapshot.preference) || '';
          } catch (error) {
            return;
          }
          if (typeof preference !== 'string' || preference.indexOf(ID_NS) !== 0) return;
          const spec = BY_ID.get(bareId(preference));
          const fallback = spec && spec.scheme === 'light' ? 'light' : 'dark';
          try {
            theme.setTheme(fallback);
          } catch (error) {
            /* ignore */
          }
        }, 1200);
      }, 'moodtone: dispose themes');

      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'moodtone',
            order: 25,
            label: () => textFor('section'),
          },
          PanelSafe,
        ),
      );
    }

    return { name: 'moodtone', inject: ['slots', 'locale', 'theme'], apply };
  },
});
