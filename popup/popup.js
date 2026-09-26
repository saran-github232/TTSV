// Popup Script for TTS Review AI Assistant – Multi-Provider

document.addEventListener("DOMContentLoaded", () => {
  const providerTabs = document.querySelectorAll(".provider-tab");
  const providerConfigs = document.querySelectorAll(".provider-config");
  const testStatus = document.getElementById("test-status");
  const btnTestKey = document.getElementById("btn-test-key");
  const btnSave = document.getElementById("btn-save");
  const saveMsg = document.getElementById("save-msg");
  const statusPill = document.getElementById("status-pill");

  let activeProvider = "gemini";

  // ---- Provider Tabs ----
  providerTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const provider = tab.dataset.provider;
      activeProvider = provider;

      providerTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      providerConfigs.forEach(cfg => cfg.style.display = "none");
      const target = document.getElementById(`config-${provider}`);
      if (target) target.style.display = "";
    });
  });

  // ---- Toggle Password Visibility ----
  document.querySelectorAll(".toggle-vis").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
      } else {
        input.type = "password";
        btn.textContent = "👁️";
      }
    });
  });

  // ---- Load existing config ----
  chrome.storage.sync.get([
    "activeProvider",
    "geminiApiKey", "selectedModel",
    "openaiApiKey", "openaiModel",
    "groqApiKey", "groqModel",
    "openrouterApiKey", "openrouterModel",
    "nvidiaApiKey", "nvidiaModel",
    "customBaseUrl", "customApiKey", "customModel",
    "styleSpanPref", "autoRunOnNext", "autoPlayAudio"
  ], (data) => {
    // Set active provider
    activeProvider = data.activeProvider || "gemini";
    providerTabs.forEach(t => t.classList.remove("active"));
    const activeTab = document.querySelector(`.provider-tab[data-provider="${activeProvider}"]`);
    if (activeTab) activeTab.classList.add("active");
    providerConfigs.forEach(cfg => cfg.style.display = "none");
    const activeCfg = document.getElementById(`config-${activeProvider}`);
    if (activeCfg) activeCfg.style.display = "";

    // Populate fields
    if (data.geminiApiKey) document.getElementById("gemini-key").value = data.geminiApiKey;
    if (data.selectedModel) {
      const sel = document.getElementById("gemini-model");
      // Only restore the saved model if it's still an offered (non-retired) option;
      // otherwise leave the dropdown on its default so users don't see a dead model.
      if ([...sel.options].some(o => o.value === data.selectedModel)) sel.value = data.selectedModel;
    }

    if (data.openaiApiKey) document.getElementById("openai-key").value = data.openaiApiKey;
    if (data.openaiModel) document.getElementById("openai-model").value = data.openaiModel;

    if (data.groqApiKey) document.getElementById("groq-key").value = data.groqApiKey;
    if (data.groqModel) document.getElementById("groq-model").value = data.groqModel;

    if (data.openrouterApiKey) document.getElementById("openrouter-key").value = data.openrouterApiKey;
    if (data.openrouterModel) document.getElementById("openrouter-model").value = data.openrouterModel;

    if (data.customBaseUrl) document.getElementById("custom-url").value = data.customBaseUrl;
    if (data.customApiKey) document.getElementById("custom-key").value = data.customApiKey;
    if (data.customModel) document.getElementById("custom-model").value = data.customModel;

    if (data.nvidiaApiKey) document.getElementById("nvidia-key").value = data.nvidiaApiKey;
    if (data.nvidiaModel) document.getElementById("nvidia-model").value = data.nvidiaModel;

    if (data.styleSpanPref !== undefined) document.getElementById("pref-style-span").checked = data.styleSpanPref;
    if (data.autoRunOnNext !== undefined) document.getElementById("pref-autorun").checked = data.autoRunOnNext;
    if (data.autoPlayAudio !== undefined) document.getElementById("pref-autoplay").checked = data.autoPlayAudio;

    updateStatusPill(activeProvider, data);
    showKeyHint();
  });

  // ---- Key Format Hints ----
  // Catches the common "invalid key" mistake: pasting a key into the wrong
  // provider tab (e.g. an nvapi-... NVIDIA key into the Gemini field).
  const KEY_PREFIXES = [
    [/^nvapi-/, "nvidia", "NVIDIA NIM"],
    [/^(AIzaSy|AQ\.)/, "gemini", "Google Gemini"],
    [/^sk-or-/, "openrouter", "OpenRouter"],
    [/^gsk_/, "groq", "Groq"],
    [/^sk-/, "openai", "OpenAI"]
  ];

  function showKeyHint() {
    const hintEl = document.getElementById("key-hint");
    if (!hintEl) return;
    hintEl.style.display = "none";
    const key = (getActiveProviderConfig().apiKey || "").trim();
    if (!key || activeProvider === "custom") return;
    const match = KEY_PREFIXES.find(([re]) => re.test(key));
    if (match && match[1] !== activeProvider) {
      hintEl.textContent = `⚠️ That looks like a ${match[2]} key. Switch to the ${match[2]} tab — on this tab it will be rejected as invalid.`;
      hintEl.style.display = "";
    }
  }

  ["gemini-key", "openai-key", "groq-key", "openrouter-key", "nvidia-key", "custom-key"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", showKeyHint);
  });

  // ---- Test Connection ----
  btnTestKey.addEventListener("click", () => {
    const { apiKey, model, customBaseUrl } = getActiveProviderConfig();

    if (!apiKey && activeProvider !== "custom") {
      testStatus.textContent = "Please enter an API key";
      testStatus.className = "test-feedback error";
      return;
    }

    testStatus.textContent = `Testing ${activeProvider}...`;
    testStatus.className = "test-feedback";

    chrome.runtime.sendMessage(
      {
        action: "TEST_API_KEY",
        provider: activeProvider,
        apiKey: apiKey,
        model: model,
        customBaseUrl: customBaseUrl
      },
      (res) => {
        if (res && res.success) {
          testStatus.textContent = "✓ Connected!";
          testStatus.className = "test-feedback success";
        } else {
          testStatus.textContent = `✗ ${res?.error || "Connection failed"}`.slice(0, 80);
          testStatus.className = "test-feedback error";
        }
      }
    );
  });

  // ---- Save All Settings ----
  btnSave.addEventListener("click", () => {
    const config = {
      activeProvider: activeProvider,

      geminiApiKey: document.getElementById("gemini-key").value.trim(),
      selectedModel: document.getElementById("gemini-model").value,

      openaiApiKey: document.getElementById("openai-key").value.trim(),
      openaiModel: document.getElementById("openai-model").value,

      groqApiKey: document.getElementById("groq-key").value.trim(),
      groqModel: document.getElementById("groq-model").value,

      openrouterApiKey: document.getElementById("openrouter-key").value.trim(),
      openrouterModel: document.getElementById("openrouter-model").value,

      customBaseUrl: document.getElementById("custom-url").value.trim(),
      customApiKey: document.getElementById("custom-key").value.trim(),
      customModel: document.getElementById("custom-model").value.trim(),

      nvidiaApiKey: document.getElementById("nvidia-key").value.trim(),
      nvidiaModel: document.getElementById("nvidia-model").value,

      styleSpanPref: document.getElementById("pref-style-span").checked,
      autoRunOnNext: document.getElementById("pref-autorun").checked,
      autoPlayAudio: document.getElementById("pref-autoplay").checked
    };

    chrome.storage.sync.set(config, () => {
      updateStatusPill(activeProvider, config);
      saveMsg.textContent = "Settings saved! ✓";
      setTimeout(() => { saveMsg.textContent = ""; }, 2500);
    });
  });

  // ---- Panel Status Diagnostics ----
  // Tells you, for the tab you opened the popup on, whether the Copilot panel
  // is actually injected — and offers a one-click fix when it isn't.
  function isSupportedTab(url) {
    if (!url) return false;
    try {
      const u = new URL(url);
      if (u.hostname === "tts-review.sabi.com" || u.hostname.endsWith(".sabi.com")) return true;
      return (u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.protocol.startsWith("http");
    } catch (_) {
      return false;
    }
  }

  function setPanelStatus(text, color) {
    const el = document.getElementById("panel-status");
    if (el) {
      el.textContent = text;
      el.style.color = color;
    }
  }

  function updatePanelStatus() {
    const btn = document.getElementById("btn-show-panel");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !isSupportedTab(tab.url)) {
        setPanelStatus("○ Not a supported page. Open tts-review.sabi.com (or the http://localhost simulator), then reopen this popup.", "#94a3b8");
        if (btn) btn.disabled = true;
        return;
      }
      if (btn) btn.disabled = false;
      chrome.tabs.sendMessage(tab.id, { action: "PANEL_PING" }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          void chrome.runtime.lastError;
          setPanelStatus("✗ Extension is not connected to this tab. This happens after installing/reloading the extension — just refresh the page (F5) and it will connect.", "#f87171");
          return;
        }
        if (resp.stealth) {
          setPanelStatus("🙈 Stealth mode is ON — the panel is hidden on purpose (it stays hidden across page loads). Press Alt+H on the page, or click the button below to show it again.", "#fbbf24");
        } else if (resp.alive) {
          setPanelStatus("✓ Copilot panel is active on this tab. Look for it on the page (bottom-right by default; drag the header to move it).", "#4ade80");
        } else {
          setPanelStatus("✗ Panel is missing on this tab (the site may have wiped it). Click the button below to re-inject it.", "#f87171");
        }
      });
    });
  }

  const btnShowPanel = document.getElementById("btn-show-panel");
  if (btnShowPanel) {
    btnShowPanel.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: "SHOW_PANEL" }, () => void chrome.runtime.lastError);
        setTimeout(updatePanelStatus, 300);
      });
    });
  }
  updatePanelStatus();

  // ---- Helpers ----
  function getActiveProviderConfig() {
    switch (activeProvider) {
      case "gemini":
        return {
          apiKey: document.getElementById("gemini-key").value.trim(),
          model: document.getElementById("gemini-model").value
        };
      case "openai":
        return {
          apiKey: document.getElementById("openai-key").value.trim(),
          model: document.getElementById("openai-model").value
        };
      case "groq":
        return {
          apiKey: document.getElementById("groq-key").value.trim(),
          model: document.getElementById("groq-model").value
        };
      case "openrouter":
        return {
          apiKey: document.getElementById("openrouter-key").value.trim(),
          model: document.getElementById("openrouter-model").value
        };
      case "nvidia":
        return {
          apiKey: document.getElementById("nvidia-key").value.trim(),
          model: document.getElementById("nvidia-model").value
        };
      case "custom":
        return {
          apiKey: document.getElementById("custom-key").value.trim(),
          model: document.getElementById("custom-model").value.trim(),
          customBaseUrl: document.getElementById("custom-url").value.trim()
        };
      default:
        return {};
    }
  }

  function updateStatusPill(provider, data) {
    const providerNames = {
      gemini: "Gemini AI",
      nvidia: "NVIDIA NIM",
      openai: "OpenAI",
      groq: "Groq",
      openrouter: "OpenRouter",
      custom: "Custom / Local"
    };

    let hasKey = false;
    switch (provider) {
      case "gemini": hasKey = !!(data.geminiApiKey || data.gemini_key); break;
      case "nvidia": hasKey = !!data.nvidiaApiKey; break;
      case "openai": hasKey = !!(data.openaiApiKey || data.openai_key); break;
      case "groq": hasKey = !!(data.groqApiKey || data.groq_key); break;
      case "openrouter": hasKey = !!(data.openrouterApiKey || data.openrouter_key); break;
      case "custom": hasKey = true; break;
    }

    if (hasKey) {
      statusPill.textContent = providerNames[provider] || "AI Online";
      statusPill.className = "status-pill online";
    } else {
      statusPill.textContent = "Heuristics";
      statusPill.className = "status-pill offline";
    }
  }
});
