(() => {
  if (window.__resumeMdInjected) return;
  window.__resumeMdInjected = true;

  const STORAGE_KEYS = {
    markdown: "resumemd.markdown",
    deepseekKey: "resumemd.deepseekKey",
    deepseekModel: "resumemd.deepseekModel",
    panelOpen: "resumemd.panelOpen"
  };
  const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

  const DEFAULT_MARKDOWN = `# 我的简历

## 使用提示
- 上传 PDF 简历后，ResumeM 会先提取文本并整理成 Markdown。
- 填写 DeepSeek key 后，可以让 AI 优化字段名称和 Markdown 结构。
- 搜索如“实习”“家庭住址”“电话”等关键词，可以快速定位内容。
`;

  const state = {
    markdown: DEFAULT_MARKDOWN,
    deepseekKey: "",
    deepseekModel: DEFAULT_DEEPSEEK_MODEL,
    panelOpen: false,
    pendingImport: "",
    pendingImportSource: "",
    activeMatchIndex: 0,
    lastSavedAt: null,
    saveTimer: null
  };

  const rootHost = document.createElement("resume-md-root");
  const shadow = rootHost.attachShadow({ mode: "open" });
  document.documentElement.append(rootHost);

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = chrome.runtime.getURL("src/content.css");

  const app = document.createElement("div");
  app.innerHTML = `
    <button class="launcher" title="打开 ResumeM" aria-label="打开 ResumeM">RM</button>
    <section class="panel" hidden aria-label="ResumeM 悬浮窗">
      <header class="topbar">
        <div class="brand">
          <strong>ResumeM</strong>
          <span>网申 Markdown 简历助手</span>
        </div>
        <div class="actions">
          <button class="icon-btn" data-action="settings" title="设置" aria-label="设置">⚙</button>
          <button class="icon-btn" data-action="close" title="关闭" aria-label="关闭">×</button>
        </div>
      </header>

      <div class="settings" hidden>
        <div class="settings-row">
          <input class="key-input" type="password" autocomplete="off" placeholder="DeepSeek API key" />
          <button class="btn" data-action="save-key">保存 key</button>
          <button class="btn" data-action="clear-key">清除 key</button>
        </div>
        <div class="settings-model">
          <span>模型</span>
          <select class="model-select" aria-label="DeepSeek 模型">
            <option value="deepseek-v4-flash">deepseek-v4-flash</option>
            <option value="deepseek-v4-pro">deepseek-v4-pro</option>
          </select>
        </div>
        <div class="hint">key 只保存在本机 Chrome storage.local 中。ResumeM 不内置公共 key。</div>
      </div>

      <div class="toolbar">
        <div class="menu-row">
          <label class="file-btn">
            上传 PDF
            <input class="pdf-input" type="file" accept="application/pdf,.pdf" hidden />
          </label>
          <label class="file-btn">
            导入 MD
            <input class="md-input" type="file" accept=".md,.markdown,text/markdown,text/plain" hidden />
          </label>
          <button class="btn primary" data-action="optimize">AI 整理</button>
          <button class="btn" data-action="export">导出 MD</button>
          <button class="btn" data-action="refresh">刷新</button>
          <button class="menu-toggle" data-action="more" aria-label="展开更多操作" aria-expanded="false">▾</button>
        </div>
        <div class="overflow-row" hidden>
          <button class="btn" data-action="copy">复制全部</button>
          <button class="btn danger" data-action="clear-all">清空数据</button>
        </div>
        <div class="search">
          <input class="search-input" type="search" placeholder="搜索字段，如 实习 / 家庭住址" />
        </div>
      </div>

      <div class="editor-shell">
        <pre class="backdrop" aria-hidden="true"></pre>
        <textarea class="editor" spellcheck="false" aria-label="简历 Markdown"></textarea>
      </div>

      <footer class="statusbar">
        <span class="status">准备就绪</span>
        <div class="search-nav" hidden>
          <button class="nav-btn" data-action="prev-match" title="上一个匹配" aria-label="上一个匹配">↑</button>
          <button class="nav-btn" data-action="next-match" title="下一个匹配" aria-label="下一个匹配">↓</button>
          <span class="match-count">0 / 0 results</span>
        </div>
      </footer>
    </section>

    <div class="modal" hidden>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="resume-md-import-title">
        <h2 id="resume-md-import-title">如何处理新解析内容？</h2>
        <p>当前已经有 Markdown 内容。请选择覆盖、追加，或取消本次导入。</p>
        <div class="dialog-actions">
          <button class="btn danger" data-import="overwrite">覆盖</button>
          <button class="btn primary" data-import="append">追加</button>
          <button class="btn" data-import="cancel">取消</button>
        </div>
      </div>
    </div>
  `;

  shadow.append(stylesheet, app);

  const $ = (selector) => shadow.querySelector(selector);
  const launcher = $(".launcher");
  const panel = $(".panel");
  const settings = $(".settings");
  const editor = $(".editor");
  const backdrop = $(".backdrop");
  const status = $(".status");
  const matchCount = $(".match-count");
  const searchNav = $(".search-nav");
  const searchInput = $(".search-input");
  const pdfInput = $(".pdf-input");
  const mdInput = $(".md-input");
  const keyInput = $(".key-input");
  const modelSelect = $(".model-select");
  const modal = $(".modal");
  const overflowRow = $(".overflow-row");
  const moreButton = $('[data-action="more"]');

  init();

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "RESUMEMD_TOGGLE") {
      togglePanel();
    }
  });

  async function init() {
    const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
    state.markdown = stored[STORAGE_KEYS.markdown] || DEFAULT_MARKDOWN;
    state.deepseekKey = stored[STORAGE_KEYS.deepseekKey] || "";
    state.deepseekModel = stored[STORAGE_KEYS.deepseekModel] || DEFAULT_DEEPSEEK_MODEL;
    state.panelOpen = Boolean(stored[STORAGE_KEYS.panelOpen]);

    editor.value = state.markdown;
    keyInput.value = state.deepseekKey;
    modelSelect.value = state.deepseekModel;
    panel.hidden = !state.panelOpen;
    renderHighlights();
    bindEvents();
  }

  function bindEvents() {
    launcher.addEventListener("click", togglePanel);
    shadow.addEventListener("click", handleActionClick);
    editor.addEventListener("input", handleEditorInput);
    editor.addEventListener("scroll", syncScroll);
    editor.addEventListener("focus", () => setEditingMode(true));
    editor.addEventListener("blur", () => setEditingMode(false));
    searchInput.addEventListener("input", handleSearchInput);
    pdfInput.addEventListener("change", handlePdfUpload);
    mdInput.addEventListener("change", handleMarkdownUpload);
    modelSelect.addEventListener("change", saveDeepSeekModel);
  }

  function togglePanel(forceOpen) {
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
    panel.hidden = !nextOpen;
    chrome.storage.local.set({ [STORAGE_KEYS.panelOpen]: nextOpen });
    if (nextOpen) editor.focus();
  }

  async function handleActionClick(event) {
    const action = event.target?.dataset?.action;
    const importAction = event.target?.dataset?.import;

    if (importAction) {
      await resolveImport(importAction);
      return;
    }

    if (!action) return;

    if (action === "more") {
      toggleMoreMenu();
      return;
    }

    if (action === "prev-match" || action === "next-match") {
      moveSearchMatch(action === "next-match" ? 1 : -1);
      return;
    }

    closeOverflowRow();

    if (action === "close") togglePanel(false);
    if (action === "settings") settings.hidden = !settings.hidden;
    if (action === "save-key") await saveDeepSeekKey();
    if (action === "clear-key") await clearDeepSeekKey();
    if (action === "copy") await copyMarkdown();
    if (action === "export") exportMarkdown();
    if (action === "refresh") await refreshFromStorage();
    if (action === "clear-all") await clearAllData();
    if (action === "optimize") await optimizeWithDeepSeek();
  }

  function toggleMoreMenu() {
    const willOpen = overflowRow.hidden;
    overflowRow.hidden = !willOpen;
    moreButton.textContent = willOpen ? "▴" : "▾";
    moreButton.setAttribute("aria-label", willOpen ? "收起更多操作" : "展开更多操作");
    moreButton.setAttribute("aria-expanded", String(willOpen));
  }

  function closeOverflowRow() {
    overflowRow.hidden = true;
    moreButton.textContent = "▾";
    moreButton.setAttribute("aria-label", "展开更多操作");
    moreButton.setAttribute("aria-expanded", "false");
  }

  function handleEditorInput() {
    state.markdown = editor.value;
    scheduleSaveMarkdown();
    renderHighlights({ scrollToMatch: false, preserveFocus: true });
  }

  function setEditingMode(isEditing) {
    editor.classList.toggle("is-editing", isEditing);
    backdrop.classList.toggle("is-hidden", isEditing);
  }

  function handleSearchInput() {
    state.activeMatchIndex = 0;
    renderHighlights({ scrollToMatch: true, preserveFocus: true });
  }

  function scheduleSaveMarkdown() {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(async () => {
      await chrome.storage.local.set({ [STORAGE_KEYS.markdown]: state.markdown });
      state.lastSavedAt = new Date();
      setStatus(`已保存 ${state.lastSavedAt.toLocaleTimeString()}`);
    }, 350);
  }

  async function handlePdfUpload() {
    const file = pdfInput.files?.[0];
    if (!file) return;

    try {
      setStatus("正在解析 PDF...");
      const markdown = await extractPdfAsMarkdown(file);
      state.pendingImport = markdown;
      state.pendingImportSource = "PDF";
      if (editor.value.trim()) {
        modal.hidden = false;
      } else {
        await applyImportedMarkdown("overwrite");
      }
    } catch (error) {
      console.error(error);
      setStatus(`PDF 解析失败：${error.message || "未知错误"}`);
    } finally {
      pdfInput.value = "";
    }
  }

  async function handleMarkdownUpload() {
    const file = mdInput.files?.[0];
    if (!file) return;

    try {
      setStatus("正在读取 Markdown...");
      const markdown = await file.text();
      state.pendingImport = markdown;
      state.pendingImportSource = "Markdown";
      if (editor.value.trim()) {
        modal.hidden = false;
      } else {
        await applyImportedMarkdown("overwrite");
      }
    } catch (error) {
      console.error(error);
      setStatus(`Markdown 导入失败：${error.message || "未知错误"}`);
    } finally {
      mdInput.value = "";
    }
  }

  async function extractPdfAsMarkdown(file) {
    const pdfjsLib = await import(chrome.runtime.getURL("vendor/pdf.mjs"));
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("vendor/pdf.worker.mjs");

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: buffer,
      cMapUrl: chrome.runtime.getURL("vendor/cmaps/"),
      cMapPacked: true,
      standardFontDataUrl: chrome.runtime.getURL("vendor/standard_fonts/"),
      isEvalSupported: false
    }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = buildLinesFromTextItems(content.items);
      pages.push(lines.join("\n"));
    }

    return basicMarkdownFromText(pages.join("\n\n"));
  }

  function buildLinesFromTextItems(items) {
    const positioned = items
      .map((item) => ({
        text: normalizePdfText(item.str || ""),
        x: Math.round(item.transform?.[4] || 0),
        y: Math.round(item.transform?.[5] || 0)
      }))
      .filter((item) => item.text);

    positioned.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 4) return b.y - a.y;
      return a.x - b.x;
    });

    const rows = [];
    for (const item of positioned) {
      const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 4);
      if (row) {
        row.items.push(item);
      } else {
        rows.push({ y: item.y, items: [item] });
      }
    }

    return rows
      .sort((a, b) => b.y - a.y)
      .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "))
      .map(cleanResumeLine)
      .filter(Boolean);
  }

  function basicMarkdownFromText(text) {
    const lines = text
      .split(/\r?\n/)
      .map(cleanResumeLine)
      .filter(Boolean);

    const result = [];
    let titleWritten = false;
    let currentSection = "";

    for (const line of lines) {
      const section = detectResumeSection(line);
      if (!titleWritten && looksLikeCandidateName(line)) {
        result.push(`# ${line}`);
        titleWritten = true;
        continue;
      }

      if (section) {
        currentSection = section;
        if (!titleWritten) {
          result.push("# 简历");
          titleWritten = true;
        }
        result.push("", `## ${section}`);
        continue;
      }

      if (!titleWritten) {
        result.push("# 简历", "", "## 个人信息");
        titleWritten = true;
        currentSection = "个人信息";
      }

      result.push(formatResumeLine(line, currentSection));
    }

    return result.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  function normalizePdfText(value) {
    return value
      .replace(/\u0000/g, "")
      .replace(/[•●]/g, "●")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanResumeLine(line) {
    return normalizePdfText(line)
      .replace(/\s+([,，。；;：:）)])\s*/g, "$1 ")
      .replace(/\s*([（(])\s*/g, " $1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function looksLikeCandidateName(line) {
    return /^[\u4e00-\u9fa5]{2,4}$/.test(line) || /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}$/.test(line);
  }

  function detectResumeSection(line) {
    const normalized = line.replace(/^#+\s*/, "").replace(/\s/g, "");
    const sectionRules = [
      ["个人信息", /^(个人信息|基本信息|联系方式)$/],
      ["教育背景", /^(教育背景|教育经历|教育)$/],
      ["实习经历", /^(实习经历|工作经历|实践经历|经历)$/],
      ["项目经历", /^(项目经历|项目经验|项目描述|项目)$/],
      ["专业技能", /^(专业技能|技能|技能清单|技术栈)$/],
      ["获奖经历", /^(获奖经历|荣誉奖项|奖项|荣誉)$/],
      ["校园经历", /^(校园经历|学生工作|社团经历)$/],
      ["自我评价", /^(自我评价|个人总结|个人评价)$/]
    ];

    const match = sectionRules.find(([, pattern]) => pattern.test(normalized));
    return match?.[0] || "";
  }

  function formatResumeLine(line, currentSection) {
    const withoutBullet = line.replace(/^[-*●]\s*/, "");
    const normalizedField = normalizeKnownField(withoutBullet);

    if (currentSection === "教育背景" && looksLikeInstitutionLine(withoutBullet)) {
      return `**${withoutBullet}**`;
    }

    if (
      (currentSection === "实习经历" || currentSection === "项目经历") &&
      looksLikeExperienceTitle(withoutBullet)
    ) {
      return `**${withoutBullet}**`;
    }

    if (/^#+\s/.test(line)) return line;
    return `- ${normalizedField}`;
  }

  function normalizeKnownField(line) {
    const fieldRules = [
      [/^(邮箱|电子邮箱|E-mail|Email)\s*[:：]?\s*/i, "电子邮箱："],
      [/^(手机|电话|联系电话|联系方式)\s*[:：]?\s*/i, "电话："],
      [/^(性别)\s*[:：]?\s*/i, "性别："],
      [/^(民族)\s*[:：]?\s*/i, "民族："],
      [/^(政治面貌)\s*[:：]?\s*/i, "政治面貌："],
      [/^(意向岗位|求职意向|目标岗位)\s*[:：]?\s*/i, "意向岗位："],
      [/^(家庭住址|现居地|地址)\s*[:：]?\s*/i, "家庭住址："],
      [/^(技术栈|技术栈：|技术)\s*[:：]?\s*/i, "技术栈："]
    ];

    for (const [pattern, label] of fieldRules) {
      if (pattern.test(line)) return line.replace(pattern, label);
    }

    return line;
  }

  function looksLikeInstitutionLine(line) {
    return /(大学|学院|学校).*(本科|硕士|博士|学士|在读|毕业|专业|985|211|双一流)/.test(line);
  }

  function looksLikeExperienceTitle(line) {
    return /(公司|科技|有限|实习|项目|系统|平台|网站|工程师|开发).*(\d{4}|\d{3}\s?[-－]\s?\d{3}|至今|实习|工程师|开发)/.test(line);
  }

  async function resolveImport(action) {
    modal.hidden = true;
    if (action === "cancel") {
      state.pendingImport = "";
      state.pendingImportSource = "";
      setStatus("已取消导入");
      return;
    }

    await applyImportedMarkdown(action);
  }

  async function applyImportedMarkdown(action) {
    const imported = state.pendingImport.trim();
    if (!imported) return;

    if (action === "append" && editor.value.trim()) {
      editor.value = `${editor.value.trim()}\n\n---\n\n${imported}\n`;
    } else {
      editor.value = `${imported}\n`;
    }

    state.pendingImport = "";
    const source = state.pendingImportSource || "内容";
    state.pendingImportSource = "";
    state.markdown = editor.value;
    await chrome.storage.local.set({ [STORAGE_KEYS.markdown]: state.markdown });
    renderHighlights();
    setStatus(
      state.deepseekKey && source === "PDF"
        ? "PDF 解析完成，可点 AI 整理提升结构"
        : action === "append"
          ? `已追加 ${source} 内容`
          : `已导入 ${source} 内容`
    );
  }

  async function saveDeepSeekKey() {
    state.deepseekKey = keyInput.value.trim();
    state.deepseekModel = modelSelect.value;
    await chrome.storage.local.set({
      [STORAGE_KEYS.deepseekKey]: state.deepseekKey,
      [STORAGE_KEYS.deepseekModel]: state.deepseekModel
    });
    settings.hidden = true;
    setStatus(state.deepseekKey ? `DeepSeek key 已保存，模型：${state.deepseekModel}` : "DeepSeek key 为空");
  }

  async function saveDeepSeekModel() {
    state.deepseekModel = modelSelect.value;
    await chrome.storage.local.set({ [STORAGE_KEYS.deepseekModel]: state.deepseekModel });
    setStatus(`DeepSeek 模型已切换为 ${state.deepseekModel}`);
  }

  async function clearDeepSeekKey() {
    state.deepseekKey = "";
    keyInput.value = "";
    await chrome.storage.local.remove(STORAGE_KEYS.deepseekKey);
    setStatus("DeepSeek key 已清除");
  }

  async function refreshFromStorage() {
    const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
    state.markdown = stored[STORAGE_KEYS.markdown] || DEFAULT_MARKDOWN;
    state.deepseekKey = stored[STORAGE_KEYS.deepseekKey] || "";
    state.deepseekModel = stored[STORAGE_KEYS.deepseekModel] || DEFAULT_DEEPSEEK_MODEL;
    state.activeMatchIndex = 0;

    editor.value = state.markdown;
    keyInput.value = state.deepseekKey;
    modelSelect.value = state.deepseekModel;
    renderHighlights({ scrollToMatch: Boolean(searchInput.value.trim()), preserveFocus: false });
    setStatus("已刷新同步最新 Markdown 内容");
  }

  async function clearAllData() {
    const confirmed = window.confirm("确认清空 ResumeM 的 Markdown 内容？");
    if (!confirmed) return;

    state.markdown = DEFAULT_MARKDOWN;
    editor.value = state.markdown;
    searchInput.value = "";
    state.activeMatchIndex = 0;
    await chrome.storage.local.remove(STORAGE_KEYS.markdown);
    renderHighlights();
    setStatus("Markdown 内容已清空，DeepSeek key 已保留");
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(editor.value);
    setStatus("已复制全部 Markdown");
  }

  function exportMarkdown() {
    const markdown = editor.value || "";
    const timestamp = formatExportTimestamp(new Date());
    const filename = `resumem-${timestamp}.md`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.documentElement.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`已导出 ${filename}`);
  }

  function formatExportTimestamp(date) {
    const parts = [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds()
    ];

    return parts.map((part) => String(part).padStart(2, "0")).join("-");
  }

  async function optimizeWithDeepSeek() {
    const key = keyInput.value.trim() || state.deepseekKey;
    const model = modelSelect.value || state.deepseekModel || DEFAULT_DEEPSEEK_MODEL;
    if (!key) {
      settings.hidden = false;
      keyInput.focus();
      setStatus("请先填写 DeepSeek key");
      return;
    }

    if (!editor.value.trim()) {
      setStatus("没有可整理的 Markdown 内容");
      return;
    }

    try {
      setStatus(`正在请求 DeepSeek 整理：${model}`);
      const optimized = await requestDeepSeekOptimization(key, editor.value, model);
      editor.value = optimized.trim() + "\n";
      state.markdown = editor.value;
      state.deepseekKey = key;
      state.deepseekModel = model;
      await chrome.storage.local.set({
        [STORAGE_KEYS.markdown]: state.markdown,
        [STORAGE_KEYS.deepseekKey]: key,
        [STORAGE_KEYS.deepseekModel]: model
      });
      renderHighlights();
      setStatus(`AI 整理完成：${model}`);
    } catch (error) {
      console.error(error);
      setStatus(`AI 整理失败：${error.message || "请稍后重试"}`);
    }
  }

  async function requestDeepSeekOptimization(key, markdown, model) {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是中文秋招简历信息整理助手。只输出 Markdown，不要解释，不要写代码块。必须保留原始事实、数字、日期、学校、公司、项目名和联系方式，不编造经历。目标是整理成方便网申搜索复制的结构化 Markdown。优先使用这些二级标题：个人信息、教育背景、实习经历、项目经历、专业技能、获奖经历、校园经历、自我评价。不要把整份简历都放在“项目经历”下面。遇到没有明确字段名的内容，请根据上下文补充清晰字段名；无法判断时放入“补充信息”。"
          },
          {
            role: "user",
            content: `请把以下 PDF 提取出的简历内容整理成有条理且准确的 Markdown。输出格式要求：
1. 第一行用“# 姓名”；如果姓名无法判断，用“# 简历”。
2. 个人信息用字段列表，如“- 电子邮箱：xxx”“- 电话：xxx”“- 意向岗位：xxx”。
3. 教育背景、实习经历、项目经历要分成清楚条目；学校、公司、项目名称可以加粗。
4. 不要丢失原文里的事实，不要补不存在的经历。
5. 如果原文顺序混乱，请按简历常见顺序重排：个人信息、教育背景、实习经历、项目经历、专业技能、获奖经历、其他。

原始内容：

${markdown}`
          }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`DeepSeek 返回 ${response.status}: ${detail.slice(0, 120)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek 没有返回内容");
    return content;
  }

  function renderHighlights(options = {}) {
    const { scrollToMatch = false, preserveFocus = false } = options;
    const text = editor.value;
    const query = searchInput.value.trim();
    const escapedText = escapeHtml(text);

    if (!query) {
      backdrop.innerHTML = escapedText || "\n";
      searchNav.hidden = true;
      matchCount.textContent = "0 / 0 results";
      syncScroll();
      return;
    }

    const regex = new RegExp(escapeRegExp(query), "gi");
    const matches = [...text.matchAll(regex)];
    state.activeMatchIndex = matches.length
      ? Math.min(state.activeMatchIndex, matches.length - 1)
      : 0;

    let renderedIndex = 0;
    backdrop.innerHTML = escapedText.replace(regex, (match) => {
      const isActive = renderedIndex === state.activeMatchIndex;
      renderedIndex += 1;
      return `<mark class="${isActive ? "active-match" : ""}">${escapeHtml(match)}</mark>`;
    });

    searchNav.hidden = matches.length <= 1;
    matchCount.textContent = matches.length
      ? `${state.activeMatchIndex + 1} / ${matches.length} results`
      : "0 / 0 results";

    if (matches[0] && scrollToMatch) {
      scrollEditorToActiveMatch();
      if (preserveFocus) searchInput.focus();
    }

    syncScroll();
  }

  function moveSearchMatch(direction) {
    const query = searchInput.value.trim();
    if (!query) return;

    const matches = [...editor.value.matchAll(new RegExp(escapeRegExp(query), "gi"))];
    if (!matches.length) return;

    state.activeMatchIndex = (state.activeMatchIndex + direction + matches.length) % matches.length;
    renderHighlights({ scrollToMatch: true, preserveFocus: true });
    searchInput.focus();
  }

  function scrollEditorToActiveMatch() {
    const activeMatch = backdrop.querySelector("mark.active-match") || backdrop.querySelector("mark");
    if (!activeMatch) return;

    const targetTop = Math.max(0, activeMatch.offsetTop - editor.clientHeight * 0.35);
    editor.scrollTop = targetTop;
    backdrop.scrollTop = targetTop;
  }

  function syncScroll() {
    backdrop.scrollTop = editor.scrollTop;
    backdrop.scrollLeft = editor.scrollLeft;
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
})();
