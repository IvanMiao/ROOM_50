interface UiDictionary {
  title: string;
  description: string;
  dynamic: Record<DynamicMessageKey, string>;
  attributes: Record<string, Record<string, string>>;
  copy: Record<string, string>;
}

const DEFAULT_INTENTS: Record<Locale, string> = {
  en: "Create a warm, independently usable neighbourhood cafe where wheelchair users have a step-free journey from entrance to ordering, pick-up, seating, and the restroom.",
  zh: "做一个温暖、易于独立使用的社区咖啡馆；轮椅用户从入口到点单、取餐、落座和卫生间全程无障碍。",
};

const TAGS: Record<IntentTag, Record<Locale, string>> = {
  quietReading: { en: "Quiet reading", zh: "安静阅读" },
  communityConnection: { en: "Community connection", zh: "邻里交流" },
  loweredOrdering: { en: "Lowered ordering", zh: "低位点单" },
  movableFurniture: { en: "Movable furniture", zh: "可移动家具" },
};

const UI: Record<Locale, UiDictionary> = {
  en: {
    title: "ROOM/50 - Accessible Cafe Agent Modeling Brief",
    description:
      "ROOM/50 is an agent-first exploratory demo that turns a plan and intent into an executable Three.js or Blender MCP brief for a 50 m2 accessible cafe.",
    dynamic: {
      builtInSample: "built-in sample",
      dimensionsUnknown: "dimensions unknown",
      dimensionsLoading: "reading dimensions",
      uploadAria: "Upload an image or floor plan",
      toastSample: "Built-in 10 x 5 m sample selected",
      toastType: "Choose a PNG, JPG, WEBP, or SVG image",
      toastSize: "Image size must be under 10 MB",
      toastUpload: "Reference loaded locally in this browser",
      toastCopyPrompt: "Prompt copied - ready for your agent",
      toastDownload: "brief.json downloaded",
      toastCopyPage: "Agent exploration prompt copied",
    },
    attributes: {
      ".site-header": { "aria-label": "Site navigation" },
      ".brand": { "aria-label": "ROOM/50 home" },
      ".nav-links": { "aria-label": "Primary navigation" },
      ".language-switcher": { "aria-label": "Language" },
      ".hero-metrics": { "aria-label": "Scenario summary" },
      ".scene-card": { "aria-label": "3D concept preview of the 50 m2 accessible cafe" },
      ".view-switcher": { "aria-label": "Preview view" },
      "#previewImage": { "alt": "Uploaded spatial reference" },
      "#removeUpload": { "aria-label": "Remove uploaded image" },
      ".intent-presets": { "aria-label": "Experience tags" },
      ".agent-terminal": { "aria-label": "Agent exploration sequence example" },
    },
    copy: {
      ".skip-link": "Skip to the prompt builder",
      ".nav-links a[href='#case']": "Fixed case",
      ".nav-links a[href='#brief-builder']": "Build brief",
      ".nav-links a[href='#agent-entry']": "Agent entry",
      ".site-header .button-dark": "Start building",
      ".eyebrow": "<span></span> EXPERIMENT 01 · ACCESSIBLE CAFE",
      "#hero-title": "Turn spatial intent<br><em>into a model an agent can execute.</em>",
      ".hero-lede":
        "Upload an image or plan and describe the experience you want. ROOM/50 bounds it to one clear task: design an accessible cafe inside a <strong>50 m2</strong> retail shell and generate a prompt for a Three.js or Blender MCP agent.",
      ".hero-actions .button-primary": "Create agent prompt <span>↘</span>",
      "#copyPageUrl": "Copy page for an agent <span>⧉</span>",
      ".hero-metrics div:nth-child(1) dd": "m2 fixed area",
      ".hero-metrics div:nth-child(2) dd": "m baseline shell",
      ".hero-metrics div:nth-child(3) dd": "m turning diameter",
      ".scene-toolbar > div > span:nth-child(2)": "BASELINE SCENE · 1:1",
      ".scene-toolbar > span": "drag to orbit",
      ".scene-fallback span": "Loading 3D scene...",
      ".label-entry": "Step-free entry",
      ".label-counter": "Lowered counter",
      ".view-switcher button[data-view='perspective']": "Perspective",
      ".view-switcher button[data-view='top']": "Top",
      ".view-switcher button[data-view='access']": "Route",
      ".scene-note": "Concept preview · not a construction drawing",
      ".case-section .section-index": "01 / FIXED CASE",
      "#case-title": "One small problem,<br>grounded in reality.",
      ".case-section .section-heading > p":
        "This is not a general-purpose interior designer. Area, shell, use, and accessibility goals are locked so the agent can focus on spatial reasoning and inspectable 3D evidence.",
      ".constraint-card:nth-child(1) h3": "Rectangular retail shell",
      ".constraint-card:nth-child(1) p":
        "Baseline: 10 m x 5 m with a 3.2 m clear height. If the uploaded plan provides better scale evidence, the agent may record the difference while preserving the 50 m2 total area.",
      ".constraint-card:nth-child(2) h3": "One continuous accessible route",
      ".constraint-card:nth-child(2) p":
        "Entrance, ordering, pick-up, at least one seat, and the restroom must connect. Target main clear route width: at least 1.2 m.",
      ".constraint-card:nth-child(3) h3": "Visible, inspectable clearances",
      ".constraint-card:nth-child(3) p":
        "Use translucent circles at the entrance, service counter, and restroom to make wheelchair turning space visible in the model.",
      ".constraint-card:nth-child(4) h3": "Concept-level model",
      ".constraint-card:nth-child(4) p":
        "Model only the shell, zones, route, key furniture, and material direction. Do not produce construction documents or invent structure and MEP conditions.",
      ".standards-note":
        "<span>!</span> Dimensions are conservative modeling targets for this exploratory demo, not a substitute for local codes, an architect, or an accessibility consultant.",
      ".builder-heading .section-index": "02 / PROMPT BUILDER",
      "#builder-title": "Three steps from a loose idea<br>to an executable brief.",
      ".builder-heading > p":
        "Inputs stay in this browser; uploaded images are never sent to a server. Give the generated prompt and original image to your agent together.",
      "#step-one-title": "Upload an image or floor plan",
      ".upload-empty strong": "Drop a plan, or click to browse",
      ".upload-empty small": "PNG / JPG / WEBP / SVG · 10 MB max",
      ".sample-row > span": "No drawing?",
      "#useSample": "Use the built-in 10 x 5 m sample →",
      "#step-two-title": "Describe the cafe experience",
      ".field-label[for='intentInput']": "Intent in one sentence",
      ".intent-chip[data-intent='quietReading']": "+ Quiet reading",
      ".intent-chip[data-intent='communityConnection']": "+ Community connection",
      ".intent-chip[data-intent='loweredOrdering']": "+ Lowered ordering",
      ".intent-chip[data-intent='movableFurniture']": "+ Movable furniture",
      "#step-three-title": "Choose the agent's modeling path",
      ".engine-card:nth-child(1) small": "Deployable interactive web scene",
      ".engine-card:nth-child(2) small": ".blend + GLB + concept renders",
      ".prompt-panel-header p": "READY FOR AGENT",
      "#prompt-title": "Copy this prompt",
      "#copyPrompt": "Copy prompt <span>⧉</span>",
      "#downloadBrief": "Download brief.json <span>↓</span>",
      ".prompt-tip":
        "<span>TIP</span> Uploads exist only in this browser. Send the source image with the prompt, or let an agent with browser control inspect this page directly.",
      ".agent-copy .section-index": "03 / AGENT ENTRY",
      "#agent-title": "If you are an agent,<br><em>start here.</em>",
      ".agent-copy > p:not(.section-index)":
        "This page is not only for humans. The fixed scenario, dimensions, modeling order, and completion checks all have machine-readable versions. Read them first; do not guess rules from screenshots.",
      ".agent-links a:nth-child(1) small": "Navigation and task summary",
      ".agent-links a:nth-child(2) small": "Repository execution guidance",
      ".agent-links a:nth-child(3) small": "Dimensions and completion checks",
      ".footer-meta p:first-child": "Exploratory demo · not a construction tool",
      ".back-to-top": "Back to top ↑",
    },
  },
  zh: {
    title: "ROOM/50 — 无障碍咖啡馆 Agent 建模简报",
    description:
      "ROOM/50 是一个面向 Agent 的探索性 Demo：把 50㎡无障碍咖啡馆的图纸与意图整理成可执行的 Three.js 或 Blender MCP 建模 Prompt。",
    dynamic: {
      builtInSample: "内置样例",
      dimensionsUnknown: "尺寸未知",
      dimensionsLoading: "正在读取尺寸",
      uploadAria: "上传图片或平面图",
      toastSample: "已使用内置 10 × 5m 样例图",
      toastType: "请选择 PNG、JPG、WEBP 或 SVG 图片",
      toastSize: "图片不能超过 10MB",
      toastUpload: "参考图已载入，仅保存在当前浏览器",
      toastCopyPrompt: "Prompt 已复制，可以交给 Agent 了",
      toastDownload: "brief.json 已下载",
      toastCopyPage: "Agent 探索指令已复制",
    },
    attributes: {
      ".site-header": { "aria-label": "网站导航" },
      ".brand": { "aria-label": "ROOM/50 首页" },
      ".nav-links": { "aria-label": "主导航" },
      ".language-switcher": { "aria-label": "语言" },
      ".hero-metrics": { "aria-label": "场景摘要" },
      ".scene-card": { "aria-label": "50平方米无障碍咖啡馆三维概念预览" },
      ".view-switcher": { "aria-label": "预览视角" },
      "#previewImage": { "alt": "用户上传的空间参考图" },
      "#removeUpload": { "aria-label": "移除上传图片" },
      ".intent-presets": { "aria-label": "意图标签" },
      ".agent-terminal": { "aria-label": "Agent 探索顺序示例" },
    },
    copy: {
      ".skip-link": "跳到 Prompt 生成器",
      ".nav-links a[href='#case']": "固定用例",
      ".nav-links a[href='#brief-builder']": "生成简报",
      ".nav-links a[href='#agent-entry']": "Agent 入口",
      ".site-header .button-dark": "开始生成",
      ".eyebrow": "<span></span> EXPERIMENT 01 · ACCESSIBLE CAFÉ",
      "#hero-title": "让空间意图，<br><em>成为 Agent 能执行的模型。</em>",
      ".hero-lede":
        "上传一张图片或图纸，描述你想要的体验。ROOM/50 会把它约束成一个明确的小任务：在 <strong>50㎡</strong> 商铺里设计一间无障碍咖啡馆，并生成可直接交给 Agent 的 Three.js 或 Blender MCP Prompt。",
      ".hero-actions .button-primary": "制作 Agent Prompt <span>↘</span>",
      "#copyPageUrl": "复制本页给 Agent <span>⧉</span>",
      ".hero-metrics div:nth-child(1) dd": "m² 固定面积",
      ".hero-metrics div:nth-child(2) dd": "m 基准外壳",
      ".hero-metrics div:nth-child(3) dd": "m 回转直径",
      ".scene-toolbar > div > span:nth-child(2)": "BASELINE SCENE · 1:1",
      ".scene-toolbar > span": "drag to orbit",
      ".scene-fallback span": "正在载入 3D 场景…",
      ".label-entry": "无台阶入口",
      ".label-counter": "低位点单台",
      ".view-switcher button[data-view='perspective']": "透视",
      ".view-switcher button[data-view='top']": "平面",
      ".view-switcher button[data-view='access']": "动线",
      ".scene-note": "概念预览 · 非施工图",
      ".case-section .section-index": "01 / 固定用例",
      "#case-title": "只解决一个足够小、<br>足够真实的问题。",
      ".case-section .section-heading > p":
        "这不是通用室内设计器。面积、房型、业态和无障碍目标已经锁定，让 Agent 把注意力放在空间推理和可检查的 3D 输出上。",
      ".constraint-card:nth-child(1) h3": "矩形商铺外壳",
      ".constraint-card:nth-child(1) p":
        "默认 10m × 5m、净高 3.2m。若上传图纸有更可靠的比例，Agent 可以记录差异，但保持总面积 50㎡。",
      ".constraint-card:nth-child(2) h3": "一条连续无障碍路径",
      ".constraint-card:nth-child(2) p":
        "入口、点单、取餐、至少一个座位和卫生间必须连通；主要通行净宽目标 ≥ 1.2m。",
      ".constraint-card:nth-child(3) h3": "可见、可检查的净空",
      ".constraint-card:nth-child(3) p":
        "在入口、服务台前和卫生间用半透明圆标记轮椅回转区，不让“无障碍”停留在文字里。",
      ".constraint-card:nth-child(4) h3": "概念级模型",
      ".constraint-card:nth-child(4) p":
        "只做外壳、分区、动线、核心家具和材质方向；不输出施工图，也不虚构结构与机电条件。",
      ".standards-note":
        "<span>!</span> 尺寸是本探索 Demo 的保守建模目标，不替代所在地法规、建筑师或无障碍顾问的复核。",
      ".builder-heading .section-index": "02 / Prompt 生成器",
      "#builder-title": "三步，把模糊想法<br>变成可执行简报。",
      ".builder-heading > p":
        "所有输入仅在当前浏览器内处理；上传图片不会发送到服务器。把生成的 Prompt 和原图一起交给你的 Agent。",
      "#step-one-title": "上传图片或平面图",
      ".upload-empty strong": "拖放图纸，或点击选择",
      ".upload-empty small": "PNG / JPG / WEBP / SVG · 最大 10MB",
      ".sample-row > span": "没有图纸？",
      "#useSample": "使用内置 10 × 5m 样例图 →",
      "#step-two-title": "描述咖啡馆体验",
      ".field-label[for='intentInput']": "一句话意图",
      ".intent-chip[data-intent='quietReading']": "+ 安静阅读",
      ".intent-chip[data-intent='communityConnection']": "+ 邻里交流",
      ".intent-chip[data-intent='loweredOrdering']": "+ 低位点单",
      ".intent-chip[data-intent='movableFurniture']": "+ 可移动家具",
      "#step-three-title": "选择 Agent 的建模方式",
      ".engine-card:nth-child(1) small": "可部署、可交互的 Web 场景",
      ".engine-card:nth-child(2) small": ".blend + GLB + 概念渲染",
      ".prompt-panel-header p": "READY FOR AGENT",
      "#prompt-title": "复制这段 Prompt",
      "#copyPrompt": "复制 Prompt <span>⧉</span>",
      "#downloadBrief": "下载 brief.json <span>↓</span>",
      ".prompt-tip":
        "<span>提示</span> 上传图只存在于当前浏览器。请把原图与 Prompt 一起发给 Agent，或让能控制当前浏览器的 Agent 直接检查本页。",
      ".agent-copy .section-index": "03 / AGENT 入口",
      "#agent-title": "如果你是 Agent，<br><em>从这里开始。</em>",
      ".agent-copy > p:not(.section-index)":
        "页面不只是给人看的。固定场景、尺寸约束、建模顺序和完成条件都有机器可读版本；先读取，再查看图纸，不要从界面截图猜规则。",
      ".agent-links a:nth-child(1) small": "导航与任务摘要",
      ".agent-links a:nth-child(2) small": "仓库级执行说明",
      ".agent-links a:nth-child(3) small": "尺寸与完成条件",
      ".footer-meta p:first-child": "探索性 Demo · 非施工设计工具",
      ".back-to-top": "回到顶部 ↑",
    },
  },
};

let locale: Locale =
  new URLSearchParams(window.location.search).get("lang") === "zh" ? "zh" : "en";

function applyCopy(nextLocale: Locale): void {
  const dictionary = UI[nextLocale];
  document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  document.title = dictionary.title;
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", dictionary.description);

  Object.entries(dictionary.copy).forEach(([selector, value]) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.innerHTML = value;
  });

  Object.entries(dictionary.attributes).forEach(([selector, attributes]) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return;
    Object.entries(attributes).forEach(([name, value]) =>
      element.setAttribute(name, value),
    );
  });

  document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((button) => {
    const active = button.dataset.lang === nextLocale;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setLocale(
  nextLocale: Locale,
  { initial = false }: { initial?: boolean } = {},
): void {
  const previousLocale = locale;
  locale = nextLocale;
  applyCopy(locale);

  if (initial) {
    const intent = document.querySelector<HTMLTextAreaElement>("#intentInput");
    if (intent) intent.value = DEFAULT_INTENTS[locale];
  } else {
    const url = new URL(window.location.href);
    if (locale === "zh") url.searchParams.set("lang", "zh");
    else url.searchParams.delete("lang");
    window.history.replaceState({}, "", url);
    window.dispatchEvent(
      new CustomEvent<LocaleChangeDetail>("room50:localechange", {
        detail: { locale, previousLocale },
      }),
    );
  }
}

window.ROOM50_I18N = {
  get locale() {
    return locale;
  },
  defaultIntent(language: Locale = locale) {
    return DEFAULT_INTENTS[language];
  },
  tagLabel(tag: IntentTag, language: Locale = locale) {
    return TAGS[tag][language] ?? tag;
  },
  t(key: DynamicMessageKey, language: Locale = locale) {
    return UI[language].dynamic[key] ?? key;
  },
};

document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    const nextLocale = button.dataset.lang;
    if (nextLocale === "en" || nextLocale === "zh") setLocale(nextLocale);
  });
});

setLocale(locale, { initial: true });
