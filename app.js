const DEFAULT_RECOGNITION_ENDPOINT = "https://kalvli-1.onrender.com/api/recognize";
const API_STORAGE_KEY = "recognitionEndpoint";
let recognitionEndpoint = DEFAULT_RECOGNITION_ENDPOINT;

const FOOD_DB = [
  { name: "米饭", calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3 },
  { name: "鸡胸肉", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: "牛油果", calories: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  { name: "生菜沙拉", calories: 35, protein: 2.2, carbs: 4, fat: 1.5 },
  { name: "炸鸡", calories: 280, protein: 18, carbs: 13, fat: 18 },
  { name: "牛肉面", calories: 215, protein: 10, carbs: 28, fat: 7 },
  { name: "披萨", calories: 266, protein: 11, carbs: 33, fat: 10 },
  { name: "三文鱼", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: "苹果", calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { name: "香蕉", calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { name: "寿司", calories: 130, protein: 6, carbs: 24, fat: 1.5 }
];

const fileInput = document.getElementById("fileInput");
const openCameraBtn = document.getElementById("openCameraBtn");
const choosePhotoBtn = document.getElementById("choosePhotoBtn");
const recognizeBtn = document.getElementById("recognizeBtn");
const recognizeStatus = document.getElementById("recognizeStatus");
const recognizeBadge = document.getElementById("recognizeBadge");
const recognizeList = document.getElementById("recognizeList");
const preview = document.getElementById("preview");
const previewImage = document.getElementById("previewImage");
const apiEndpointInput = document.getElementById("apiEndpointInput");
const apiSaveBtn = document.getElementById("apiSaveBtn");
const retryBtn = document.getElementById("retryBtn");
const retryCountEl = document.getElementById("retryCount");
const errorMessageEl = document.getElementById("errorMessage");
const toggleDebugBtn = document.getElementById("toggleDebugBtn");
const debugBody = document.getElementById("debugBody");
const debugOutput = document.getElementById("debugOutput");
const copyDebugBtn = document.getElementById("copyDebugBtn");
const exportDebugBtn = document.getElementById("exportDebugBtn");
const correctionList = document.getElementById("correctionList");
const clearCorrectionsBtn = document.getElementById("clearCorrectionsBtn");

const mealList = document.getElementById("mealList");
const totalCaloriesEl = document.getElementById("totalCalories");
const totalItemsEl = document.getElementById("totalItems");
const totalProteinEl = document.getElementById("totalProtein");
const totalCarbsEl = document.getElementById("totalCarbs");
const totalFatEl = document.getElementById("totalFat");
const clearAllBtn = document.getElementById("clearAllBtn");

const manualName = document.getElementById("manualName");
const manualCalories = document.getElementById("manualCalories");
const manualProtein = document.getElementById("manualProtein");
const manualCarbs = document.getElementById("manualCarbs");
const manualFat = document.getElementById("manualFat");
const manualGrams = document.getElementById("manualGrams");
const manualAddBtn = document.getElementById("manualAddBtn");

let currentFile = null;
let mealItems = [];
let lastResponse = null;
let retryCount = 0;
let correctionHistory = [];

const CORRECTION_STORAGE_KEY = "correctionHistory";
const MAX_CORRECTION_HISTORY = 30;

const getEndpointFromQuery = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("api");
};

const syncEndpointToUI = () => {
  if (!apiEndpointInput) return;
  apiEndpointInput.value = recognitionEndpoint === DEFAULT_RECOGNITION_ENDPOINT ? "" : recognitionEndpoint;
};

const initApiEndpoint = () => {
  const fromQuery = getEndpointFromQuery();
  if (fromQuery) {
    recognitionEndpoint = fromQuery.trim();
    localStorage.setItem(API_STORAGE_KEY, recognitionEndpoint);
  } else {
    const saved = localStorage.getItem(API_STORAGE_KEY);
    if (saved) {
      recognitionEndpoint = saved;
    }
  }

  syncEndpointToUI();
};

const roundTo = (value, digits = 1) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const safeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const setStatus = (text, type = "") => {
  recognizeStatus.textContent = text;
  recognizeStatus.dataset.type = type;
};

const setBadge = (text) => {
  recognizeBadge.textContent = text;
};

const setRetryVisible = (visible) => {
  if (!retryBtn) return;
  retryBtn.hidden = !visible;
};

const updateRetryCount = () => {
  if (!retryCountEl) return;
  retryCountEl.textContent = `重试次数：${retryCount}`;
};

const setErrorMessage = (message = "") => {
  if (!errorMessageEl) return;
  errorMessageEl.textContent = message ? `错误原因：${message}` : "";
};

const buildErrorMessage = (error, responseText = "") => {
  if (!error) return "未知错误";
  const base = error.message || "识别失败";
  if (responseText) {
    const trimmed = responseText.replace(/\s+/g, " ").slice(0, 120);
    return `${base} · ${trimmed}`;
  }
  return base;
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const loadCorrectionHistory = () => {
  const raw = localStorage.getItem(CORRECTION_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const saveCorrectionHistory = () => {
  localStorage.setItem(CORRECTION_STORAGE_KEY, JSON.stringify(correctionHistory));
};

const renderCorrectionHistory = () => {
  if (!correctionList) return;
  if (!correctionHistory.length) {
    correctionList.innerHTML = "<div class=\"recognize__history-item\">暂无校正记录。</div>";
    return;
  }

  correctionList.innerHTML = "";
  correctionHistory.forEach((entry) => {
    const container = document.createElement("div");
    container.className = "recognize__history-item";
    const time = formatTime(entry.time);
    container.textContent = `${time} · ${entry.fromName} → ${entry.toName} · kcal ${entry.fromCalories}→${entry.toCalories} · P ${entry.fromProtein}→${entry.toProtein} · C ${entry.fromCarbs}→${entry.toCarbs} · F ${entry.fromFat}→${entry.toFat}`;
    correctionList.appendChild(container);
  });
};

const addCorrectionHistory = (entry) => {
  correctionHistory.unshift(entry);
  if (correctionHistory.length > MAX_CORRECTION_HISTORY) {
    correctionHistory = correctionHistory.slice(0, MAX_CORRECTION_HISTORY);
  }
  saveCorrectionHistory();
  renderCorrectionHistory();
};

const renderDebug = () => {
  if (!debugOutput) return;
  if (!lastResponse) {
    debugOutput.textContent = "暂无数据";
    return;
  }
  debugOutput.textContent = JSON.stringify(lastResponse, null, 2);
};

const updatePreview = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    previewImage.style.display = "block";
    preview.classList.add("has-image");
  };
  reader.readAsDataURL(file);
};

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  currentFile = file;
  updatePreview(file);
  recognizeBtn.disabled = false;
  setStatus(`已选择图片：${file.name}`);
  setBadge("准备识别");
};

const pickFromDb = (name) => {
  return FOOD_DB.find((item) => item.name === name) || FOOD_DB[0];
};

const mockRecognize = (file) => {
  const filename = file.name.toLowerCase();
  const hints = [
    { key: "rice", name: "米饭" },
    { key: "fan", name: "米饭" },
    { key: "chicken", name: "鸡胸肉" },
    { key: "salad", name: "生菜沙拉" },
    { key: "pizza", name: "披萨" },
    { key: "apple", name: "苹果" },
    { key: "banana", name: "香蕉" },
    { key: "sushi", name: "寿司" }
  ];

  const matched = hints.find((hint) => filename.includes(hint.key));
  const primary = matched ? pickFromDb(matched.name) : FOOD_DB[Math.floor(Math.random() * FOOD_DB.length)];
  const secondary = FOOD_DB.filter((item) => item.name !== primary.name);
  const extra = secondary.sort(() => 0.5 - Math.random()).slice(0, 2);

  return [
    { ...primary, confidence: 0.86 },
    { ...extra[0], confidence: 0.61 },
    { ...extra[1], confidence: 0.48 }
  ].map((item) => ({
    name: item.name,
    confidence: item.confidence,
    caloriesPer100: item.calories,
    proteinPer100: item.protein,
    carbsPer100: item.carbs,
    fatPer100: item.fat
  }));
};

const normalizeItems = (data) => {
  if (!data) return [];
  const rawItems = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
  return rawItems
    .map((item) => {
      const normalized = {
        name: item.name || item.label || item.food || "未知食物",
        confidence: safeNumber(item.confidence) ?? 0,
        caloriesPer100: safeNumber(item.caloriesPer100 ?? item.calories ?? item.kcal ?? item.energy),
        proteinPer100: safeNumber(item.proteinPer100 ?? item.protein),
        carbsPer100: safeNumber(item.carbsPer100 ?? item.carbs ?? item.carbohydrate),
        fatPer100: safeNumber(item.fatPer100 ?? item.fat)
      };

      const fallback = FOOD_DB.find((food) => normalized.name.includes(food.name));
      if (fallback) {
        normalized.caloriesPer100 ??= fallback.calories;
        normalized.proteinPer100 ??= fallback.protein;
        normalized.carbsPer100 ??= fallback.carbs;
        normalized.fatPer100 ??= fallback.fat;
      }

      return normalized;
    })
    .filter((item) => item.name);
};

const formatValue = (value) => (value == null ? "—" : roundTo(value, 1));

const renderRecognizeList = (items) => {
  recognizeList.innerHTML = "";
  if (!items || items.length === 0) {
    recognizeList.innerHTML = "<p class=\"status\">未识别到食物</p>";
    return;
  }

  items.forEach((item) => {
    if (!item._localId) {
      item._localId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }

    const container = document.createElement("div");
    container.className = "recognize__item";

    const header = document.createElement("div");
    header.className = "recognize__row";

    const name = document.createElement("div");
    name.className = "recognize__name";
    name.textContent = item.name;

    const meta = document.createElement("div");
    meta.className = "recognize__meta";
    const confidence = item.confidence ? `${Math.round(item.confidence * 100)}% 可信度 · ` : "";
    const caloriesText = item.caloriesPer100 != null ? `${item.caloriesPer100} kcal/100g` : "热量待补充";
    meta.textContent = `${confidence}${caloriesText}`;

    header.appendChild(name);
    header.appendChild(meta);

    const macroTags = document.createElement("div");
    macroTags.className = "macro-tags";
    macroTags.innerHTML = `
      <span>蛋白 ${formatValue(item.proteinPer100)}g</span>
      <span>碳水 ${formatValue(item.carbsPer100)}g</span>
      <span>脂肪 ${formatValue(item.fatPer100)}g</span>
    `;

    const actions = document.createElement("div");
    actions.className = "recognize__actions";

    const gramsInput = document.createElement("input");
    gramsInput.type = "number";
    gramsInput.min = "1";
    gramsInput.value = "150";

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn--primary";
    addBtn.textContent = "添加";
    addBtn.addEventListener("click", () => {
      addMealItem({
        name: item.name,
        caloriesPer100: item.caloriesPer100 ?? 0,
        proteinPer100: item.proteinPer100 ?? 0,
        carbsPer100: item.carbsPer100 ?? 0,
        fatPer100: item.fatPer100 ?? 0,
        grams: Number(gramsInput.value) || 100,
        sourceId: item._localId
      });
      updateUpdateBtn();
    });

    actions.appendChild(gramsInput);
    actions.appendChild(addBtn);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "recognize__toggle";
    toggleBtn.textContent = "校正";
    actions.appendChild(toggleBtn);

    const editPanel = document.createElement("div");
    editPanel.className = "recognize__edit";

    const editRow = document.createElement("div");
    editRow.className = "recognize__edit-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = item.name;
    nameInput.placeholder = "食物名称";

    const calInput = document.createElement("input");
    calInput.type = "number";
    calInput.min = "0";
    calInput.placeholder = "热量/100g";
    calInput.value = item.caloriesPer100 ?? "";

    const proteinInput = document.createElement("input");
    proteinInput.type = "number";
    proteinInput.min = "0";
    proteinInput.placeholder = "蛋白(g)";
    proteinInput.value = item.proteinPer100 ?? "";

    const carbsInput = document.createElement("input");
    carbsInput.type = "number";
    carbsInput.min = "0";
    carbsInput.placeholder = "碳水(g)";
    carbsInput.value = item.carbsPer100 ?? "";

    const fatInput = document.createElement("input");
    fatInput.type = "number";
    fatInput.min = "0";
    fatInput.placeholder = "脂肪(g)";
    fatInput.value = item.fatPer100 ?? "";

    editRow.appendChild(nameInput);
    editRow.appendChild(calInput);
    editRow.appendChild(proteinInput);
    editRow.appendChild(carbsInput);
    editRow.appendChild(fatInput);

    const editActions = document.createElement("div");
    editActions.className = "recognize__edit-actions";

    const applyBtn = document.createElement("button");
    applyBtn.className = "btn btn--primary";
    applyBtn.textContent = "应用校正";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn--ghost";
    cancelBtn.textContent = "取消";

    const updateBtn = document.createElement("button");
    updateBtn.className = "btn btn--ghost";

    const getSourceCount = () => mealItems.filter((m) => m.sourceId === item._localId).length;
    const updateUpdateBtn = () => {
      const count = getSourceCount();
      updateBtn.textContent = `更新已添加记录 (${count})`;
      updateBtn.disabled = count === 0;
    };
    updateUpdateBtn();

    editActions.appendChild(applyBtn);
    editActions.appendChild(cancelBtn);
    editActions.appendChild(updateBtn);

    editPanel.appendChild(editRow);
    editPanel.appendChild(editActions);

    const refreshDisplay = () => {
      name.textContent = item.name;
      const updatedConfidence = item.confidence ? `${Math.round(item.confidence * 100)}% 可信度 · ` : "";
      const updatedCalories = item.caloriesPer100 != null ? `${item.caloriesPer100} kcal/100g` : "热量待补充";
      meta.textContent = `${updatedConfidence}${updatedCalories}`;
      macroTags.innerHTML = `
        <span>蛋白 ${formatValue(item.proteinPer100)}g</span>
        <span>碳水 ${formatValue(item.carbsPer100)}g</span>
        <span>脂肪 ${formatValue(item.fatPer100)}g</span>
      `;
    };

    toggleBtn.addEventListener("click", () => {
      const willOpen = !editPanel.classList.contains("active");
      editPanel.classList.toggle("active", willOpen);
      toggleBtn.textContent = willOpen ? "收起" : "校正";
    });

    cancelBtn.addEventListener("click", () => {
      editPanel.classList.remove("active");
      toggleBtn.textContent = "校正";
    });

    applyBtn.addEventListener("click", () => {
      const previous = {
        name: item.name,
        caloriesPer100: item.caloriesPer100 ?? "—",
        proteinPer100: item.proteinPer100 ?? "—",
        carbsPer100: item.carbsPer100 ?? "—",
        fatPer100: item.fatPer100 ?? "—"
      };

      const nextName = nameInput.value.trim() || item.name;
      item.name = nextName;
      item.caloriesPer100 = safeNumber(calInput.value) ?? item.caloriesPer100;
      item.proteinPer100 = safeNumber(proteinInput.value) ?? item.proteinPer100;
      item.carbsPer100 = safeNumber(carbsInput.value) ?? item.carbsPer100;
      item.fatPer100 = safeNumber(fatInput.value) ?? item.fatPer100;
      refreshDisplay();
      setStatus("已应用校正，可重新添加计算。", "success");

      addCorrectionHistory({
        time: Date.now(),
        fromName: previous.name,
        toName: item.name,
        fromCalories: previous.caloriesPer100,
        toCalories: item.caloriesPer100 ?? "—",
        fromProtein: previous.proteinPer100,
        toProtein: item.proteinPer100 ?? "—",
        fromCarbs: previous.carbsPer100,
        toCarbs: item.carbsPer100 ?? "—",
        fromFat: previous.fatPer100,
        toFat: item.fatPer100 ?? "—"
      });
    });

    updateBtn.addEventListener("click", () => {
      const count = updateMealItemsFromSource({
        sourceId: item._localId,
        name: item.name,
        caloriesPer100: item.caloriesPer100 ?? 0,
        proteinPer100: item.proteinPer100 ?? 0,
        carbsPer100: item.carbsPer100 ?? 0,
        fatPer100: item.fatPer100 ?? 0
      });
      updateUpdateBtn();
      setStatus(`已更新 ${count} 条已添加记录。`, "success");
    });

    container.appendChild(header);
    container.appendChild(macroTags);
    container.appendChild(actions);
    container.appendChild(editPanel);

    recognizeList.appendChild(container);
  });
};

const addMealItem = ({ name, caloriesPer100, proteinPer100, carbsPer100, fatPer100, grams, sourceId = null }) => {
  const calories = Math.round((caloriesPer100 * grams) / 100);
  const protein = roundTo((proteinPer100 * grams) / 100, 1);
  const carbs = roundTo((carbsPer100 * grams) / 100, 1);
  const fat = roundTo((fatPer100 * grams) / 100, 1);

  const item = {
    id: Date.now() + Math.random(),
    name,
    caloriesPer100,
    proteinPer100,
    carbsPer100,
    fatPer100,
    grams,
    calories,
    protein,
    carbs,
    fat,
    sourceId
  };

  mealItems.unshift(item);
  renderMealList();
  updateTotals();
};

const updateMealItemsFromSource = ({ sourceId, name, caloriesPer100, proteinPer100, carbsPer100, fatPer100 }) => {
  if (!sourceId) return 0;
  let updatedCount = 0;

  mealItems = mealItems.map((item) => {
    if (item.sourceId !== sourceId) return item;
    const calories = Math.round((caloriesPer100 * item.grams) / 100);
    const protein = roundTo((proteinPer100 * item.grams) / 100, 1);
    const carbs = roundTo((carbsPer100 * item.grams) / 100, 1);
    const fat = roundTo((fatPer100 * item.grams) / 100, 1);

    updatedCount += 1;
    return {
      ...item,
      name,
      caloriesPer100,
      proteinPer100,
      carbsPer100,
      fatPer100,
      calories,
      protein,
      carbs,
      fat
    };
  });

  renderMealList();
  updateTotals();
  return updatedCount;
};

const renderMealList = () => {
  mealList.innerHTML = "";
  if (mealItems.length === 0) {
    mealList.innerHTML = "<p class=\"status\">暂无记录，识别或手动添加吧。</p>";
    return;
  }

  mealItems.forEach((item) => {
    const container = document.createElement("div");
    container.className = "meal__item pop";

    const info = document.createElement("div");
    const name = document.createElement("div");
    name.className = "meal__name";
    name.textContent = item.name;

    const meta = document.createElement("div");
    meta.className = "meal__meta";
    meta.textContent = `${item.grams}g · ${item.caloriesPer100} kcal/100g`;

    const macro = document.createElement("div");
    macro.className = "meal__macro";
    macro.textContent = `蛋白 ${formatValue(item.protein)}g · 碳水 ${formatValue(item.carbs)}g · 脂肪 ${formatValue(item.fat)}g`;

    info.appendChild(name);
    info.appendChild(meta);
    info.appendChild(macro);

    const right = document.createElement("div");
    right.style.textAlign = "right";

    const calories = document.createElement("div");
    calories.className = "meal__calories";
    calories.textContent = `${item.calories} kcal`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "meal__remove";
    removeBtn.textContent = "移除";
    removeBtn.addEventListener("click", () => {
      mealItems = mealItems.filter((m) => m.id !== item.id);
      renderMealList();
      updateTotals();
    });

    right.appendChild(calories);
    right.appendChild(removeBtn);

    container.appendChild(info);
    container.appendChild(right);

    mealList.appendChild(container);
  });
};

const updateTotals = () => {
  const totals = mealItems.reduce(
    (sum, item) => {
      sum.calories += item.calories || 0;
      sum.protein += item.protein || 0;
      sum.carbs += item.carbs || 0;
      sum.fat += item.fat || 0;
      return sum;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  totalCaloriesEl.textContent = totals.calories;
  totalItemsEl.textContent = mealItems.length;
  totalProteinEl.textContent = roundTo(totals.protein, 1);
  totalCarbsEl.textContent = roundTo(totals.carbs, 1);
  totalFatEl.textContent = roundTo(totals.fat, 1);
};

const handleRecognize = async () => {
  if (!currentFile) {
    setStatus("请先选择或拍摄图片");
    return;
  }

  recognizeBtn.disabled = true;
  setRetryVisible(false);
  setStatus("识别中，请稍候...", "loading");
  setBadge("识别中");
  setErrorMessage("");

  try {
    let items = [];
    let usedMock = false;
    let hadError = false;
    let errorMessage = "";

    if (recognitionEndpoint) {
      try {
        const formData = new FormData();
        formData.append("image", currentFile);

        const response = await fetch(recognitionEndpoint, {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          const responseText = await response.text();
          throw new Error(buildErrorMessage(new Error(`识别服务异常 (${response.status})`), responseText));
        }

        const data = await response.json();
        lastResponse = data;
        items = normalizeItems(data);
      } catch (error) {
        items = mockRecognize(currentFile);
        usedMock = true;
        hadError = true;
        errorMessage = buildErrorMessage(error);
        lastResponse = { source: "mock", reason: "fetch_failed", error: errorMessage, items };
      }
    } else {
      items = mockRecognize(currentFile);
      usedMock = true;
      lastResponse = { source: "mock", reason: "no_endpoint", items };
    }

    if (!items.length) {
      items = mockRecognize(currentFile);
      usedMock = true;
      hadError = true;
      errorMessage = "识别结果为空";
      lastResponse = { source: "mock", reason: "empty_result", error: errorMessage, items };
    }

    setStatus(usedMock ? "识别完成（模拟结果）。" : "识别完成，可添加到记录。", "success");
    setBadge(usedMock ? "模拟结果" : "已识别");
    renderRecognizeList(items);
    renderDebug();
    if (hadError) {
      retryCount += 1;
      updateRetryCount();
      setErrorMessage(errorMessage);
      setRetryVisible(true);
    } else {
      retryCount = 0;
      updateRetryCount();
      setErrorMessage("");
      setRetryVisible(false);
    }
  } catch (error) {
    setStatus("识别失败，请稍后再试。", "error");
    setBadge("识别失败");
    setRetryVisible(true);
    retryCount += 1;
    updateRetryCount();
    const message = buildErrorMessage(error);
    setErrorMessage(message);
    lastResponse = { error: message };
    renderDebug();
  } finally {
    recognizeBtn.disabled = false;
  }
};

openCameraBtn.addEventListener("click", () => fileInput.click());
choosePhotoBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileChange);
recognizeBtn.addEventListener("click", handleRecognize);
if (retryBtn) {
  retryBtn.addEventListener("click", handleRecognize);
}
if (apiSaveBtn) {
  apiSaveBtn.addEventListener("click", () => {
    const value = apiEndpointInput?.value.trim();
    if (!value) {
      recognitionEndpoint = DEFAULT_RECOGNITION_ENDPOINT;
      localStorage.removeItem(API_STORAGE_KEY);
      syncEndpointToUI();
      setStatus("已恢复默认识别地址。", "success");
      return;
    }

    recognitionEndpoint = value;
    localStorage.setItem(API_STORAGE_KEY, recognitionEndpoint);
    setStatus("已保存识别地址。", "success");
  });
}
if (toggleDebugBtn && debugBody) {
  toggleDebugBtn.addEventListener("click", () => {
    const willShow = debugBody.hidden;
    debugBody.hidden = !willShow;
    toggleDebugBtn.textContent = willShow ? "收起" : "展开";
  });
}
if (copyDebugBtn) {
  copyDebugBtn.addEventListener("click", async () => {
    if (!lastResponse) {
      setStatus("暂无可复制的调试数据。", "error");
      return;
    }

    const text = JSON.stringify(lastResponse, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("已复制原始数据。", "success");
    } catch (error) {
      setStatus("复制失败，请手动复制。", "error");
    }
  });
}
if (exportDebugBtn) {
  exportDebugBtn.addEventListener("click", () => {
    if (!lastResponse) {
      setStatus("暂无可导出的调试数据。", "error");
      return;
    }

    const text = JSON.stringify(lastResponse, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `recognition-raw-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus("已导出调试数据。", "success");
  });
}
if (clearCorrectionsBtn) {
  clearCorrectionsBtn.addEventListener("click", () => {
    correctionHistory = [];
    saveCorrectionHistory();
    renderCorrectionHistory();
    setStatus("已清空校正历史。", "success");
  });
}

manualAddBtn.addEventListener("click", () => {
  const name = manualName.value.trim();
  const calories = Number(manualCalories.value);
  const grams = Number(manualGrams.value);
  const protein = Number(manualProtein.value) || 0;
  const carbs = Number(manualCarbs.value) || 0;
  const fat = Number(manualFat.value) || 0;

  if (!name || !calories || !grams) {
    setStatus("请填写完整的手动添加信息（至少需要热量和份量）。", "error");
    return;
  }

  addMealItem({
    name,
    caloriesPer100: calories,
    proteinPer100: protein,
    carbsPer100: carbs,
    fatPer100: fat,
    grams
  });

  manualName.value = "";
  manualCalories.value = "";
  manualProtein.value = "";
  manualCarbs.value = "";
  manualFat.value = "";
  manualGrams.value = "";
  setStatus("已手动添加。", "success");
});

clearAllBtn.addEventListener("click", () => {
  mealItems = [];
  renderMealList();
  updateTotals();
  setStatus("已清空记录。");
});

renderMealList();
updateTotals();
initApiEndpoint();
renderDebug();
updateRetryCount();
setErrorMessage("");
correctionHistory = loadCorrectionHistory();
renderCorrectionHistory();
setStatus("等待拍照识别。");
