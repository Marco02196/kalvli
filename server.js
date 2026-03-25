const express = require("express");
const multer = require("multer");
const cors = require("cors");
const FormData = require("form-data");
const fetch = require("node-fetch");
const path = require("path");
require("dotenv").config();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const LOGMEAL_API_BASE = process.env.LOGMEAL_API_BASE || "https://api.logmeal.com";
const LOGMEAL_APIUSER_TOKEN = process.env.LOGMEAL_APIUSER_TOKEN || "";
const LOGMEAL_NUTRITION_PATH = process.env.LOGMEAL_NUTRITION_PATH || "/v2/nutrition/recipe/nutritionalInfo";

const MOCK_FOODS = [
  { name: "米饭", caloriesPer100: 116, proteinPer100: 2.6, carbsPer100: 25.9, fatPer100: 0.3 },
  { name: "鸡胸肉", caloriesPer100: 165, proteinPer100: 31, carbsPer100: 0, fatPer100: 3.6 },
  { name: "牛油果", caloriesPer100: 160, proteinPer100: 2, carbsPer100: 8.5, fatPer100: 14.7 },
  { name: "生菜沙拉", caloriesPer100: 35, proteinPer100: 2.2, carbsPer100: 4, fatPer100: 1.5 },
  { name: "炸鸡", caloriesPer100: 280, proteinPer100: 18, carbsPer100: 13, fatPer100: 18 },
  { name: "披萨", caloriesPer100: 266, proteinPer100: 11, carbsPer100: 33, fatPer100: 10 },
  { name: "苹果", caloriesPer100: 52, proteinPer100: 0.3, carbsPer100: 14, fatPer100: 0.2 },
  { name: "香蕉", caloriesPer100: 89, proteinPer100: 1.1, carbsPer100: 23, fatPer100: 0.3 }
];

const pickMockItems = (filename = "") => {
  const name = filename.toLowerCase();
  const hintMap = [
    { key: "rice", name: "米饭" },
    { key: "fan", name: "米饭" },
    { key: "chicken", name: "鸡胸肉" },
    { key: "salad", name: "生菜沙拉" },
    { key: "pizza", name: "披萨" },
    { key: "apple", name: "苹果" },
    { key: "banana", name: "香蕉" }
  ];

  const hinted = hintMap.find((hint) => name.includes(hint.key));
  const primary = hinted
    ? MOCK_FOODS.find((food) => food.name === hinted.name)
    : MOCK_FOODS[Math.floor(Math.random() * MOCK_FOODS.length)];

  const others = MOCK_FOODS.filter((food) => food.name !== primary.name)
    .sort(() => 0.5 - Math.random())
    .slice(0, 2);

  const items = [primary, ...others].map((food, index) => ({
    name: food.name,
    confidence: index === 0 ? 0.86 : 0.55 - index * 0.1,
    caloriesPer100: food.caloriesPer100,
    proteinPer100: food.proteinPer100,
    carbsPer100: food.carbsPer100,
    fatPer100: food.fatPer100
  }));

  return items;
};

app.use(cors());

const publicRoot = __dirname;
app.use("/assets", express.static(path.join(publicRoot, "assets")));
app.get("/", (req, res) => res.sendFile(path.join(publicRoot, "index.html")));
app.get("/styles.css", (req, res) => res.sendFile(path.join(publicRoot, "styles.css")));
app.get("/app.js", (req, res) => res.sendFile(path.join(publicRoot, "app.js")));
app.get("/manifest.json", (req, res) => res.sendFile(path.join(publicRoot, "manifest.json")));

const normalizeKey = (value) => (value || "").toString().trim().toLowerCase();

const extractNutrientsFromArray = (arr) => {
  const findValue = (keywords) => {
    const hit = arr.find((item) => {
      const name = normalizeKey(item.name || item.label || item.nutrient || item.code || item.id);
      return keywords.some((key) => name.includes(key));
    });
    if (!hit) return null;
    return Number(hit.value ?? hit.quantity ?? hit.amount ?? hit.qty ?? hit.value_per_100g);
  };

  return {
    caloriesPer100: findValue(["energy", "kcal", "calorie"]),
    proteinPer100: findValue(["protein", "proteins", "procnt"]),
    carbsPer100: findValue(["carb", "carbohydrate", "carbs", "chocdf"]),
    fatPer100: findValue(["fat", "fats", "lipid", "fat_total"])
  };
};

const extractNutrientsFromObject = (obj) => {
  if (!obj || typeof obj !== "object") return {};

  const byKey = (keys) => {
    for (const key of Object.keys(obj)) {
      const normalized = normalizeKey(key);
      if (keys.some((k) => normalized.includes(k))) {
        const value = obj[key];
        const raw = typeof value === "object" ? value.value ?? value.quantity ?? value.amount : value;
        const num = Number(raw);
        if (Number.isFinite(num)) return num;
      }
    }
    return null;
  };

  return {
    caloriesPer100: byKey(["energy", "kcal", "calorie"]),
    proteinPer100: byKey(["protein", "procnt"]),
    carbsPer100: byKey(["carb", "carbohydrate", "chocdf"]),
    fatPer100: byKey(["fat", "lipid"])
  };
};

const extractNutrients = (entry) => {
  if (!entry) return {};
  const source = entry.nutritional_info || entry.nutrients || entry.nutrition || entry;

  if (Array.isArray(source)) {
    return extractNutrientsFromArray(source);
  }

  if (Array.isArray(source.nutrients)) {
    return extractNutrientsFromArray(source.nutrients);
  }

  return extractNutrientsFromObject(source);
};

const getImageId = (data) => {
  return data?.imageId ?? data?.image_id ?? data?.imageID ?? null;
};

const getCandidates = (segData) => {
  const segments = Array.isArray(segData?.segmentation_results)
    ? segData.segmentation_results
    : Array.isArray(segData?.results)
      ? segData.results
      : [];

  const candidates = [];

  if (segments.length === 0 && Array.isArray(segData?.recognition_results)) {
    segments.push({ recognition_results: segData.recognition_results });
  }

  segments.forEach((segment, idx) => {
    const list =
      segment.recognition_results ||
      segment.recognition ||
      segment.dishes ||
      segment.foods ||
      segment.results ||
      [];

    if (!Array.isArray(list) || list.length === 0) return;

    const best = list.reduce((acc, cur) => {
      const curProb = Number(cur.prob ?? cur.confidence ?? cur.score ?? 0);
      const accProb = Number(acc.prob ?? acc.confidence ?? acc.score ?? 0);
      return curProb > accProb ? cur : acc;
    }, list[0]);

    candidates.push({
      name: best.name || best.label || best.food_name || best.food || "未知食物",
      confidence: Number(best.prob ?? best.confidence ?? best.score ?? 0),
      position: segment.food_item_position ?? segment.position ?? idx
    });
  });

  return candidates;
};

app.post("/api/recognize", upload.single("image"), async (req, res) => {
  if (!LOGMEAL_APIUSER_TOKEN) {
    const items = pickMockItems(req.file?.originalname || "");
    return res.json({
      source: "mock",
      reason: "missing_token",
      items,
      raw: { note: "LOGMEAL_APIUSER_TOKEN 未配置，返回模拟识别结果。" }
    });
  }

  if (!req.file) {
    return res.status(400).json({ error: "缺少图片文件" });
  }

  try {
    const formData = new FormData();
    formData.append("image", req.file.buffer, {
      filename: req.file.originalname || "upload.jpg",
      contentType: req.file.mimetype
    });

    const segmentationResponse = await fetch(`${LOGMEAL_API_BASE}/v2/image/segmentation/complete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOGMEAL_APIUSER_TOKEN}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!segmentationResponse.ok) {
      const text = await segmentationResponse.text();
      return res.status(502).json({ error: "LogMeal 识别失败", detail: text });
    }

    const segmentationData = await segmentationResponse.json();
    const imageId = getImageId(segmentationData);

    let nutritionData = null;
    if (imageId) {
      const nutritionResponse = await fetch(`${LOGMEAL_API_BASE}${LOGMEAL_NUTRITION_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOGMEAL_APIUSER_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ imageId })
      });

      if (nutritionResponse.ok) {
        nutritionData = await nutritionResponse.json();
      }
    }

    const candidates = getCandidates(segmentationData);
    const nutritionMap = new Map();

    const nutritionItems = nutritionData?.nutritional_info_per_item || nutritionData?.items || [];
    if (Array.isArray(nutritionItems)) {
      nutritionItems.forEach((entry, idx) => {
        const key = entry.food_item_position ?? entry.position ?? idx;
        nutritionMap.set(key, extractNutrients(entry));
      });
    }

    const items = candidates.map((candidate) => {
      const nutrients = nutritionMap.get(candidate.position) || {};
      return {
        name: candidate.name,
        confidence: candidate.confidence,
        caloriesPer100: nutrients.caloriesPer100 ?? null,
        proteinPer100: nutrients.proteinPer100 ?? null,
        carbsPer100: nutrients.carbsPer100 ?? null,
        fatPer100: nutrients.fatPer100 ?? null
      };
    });

    return res.json({
      source: "logmeal",
      imageId,
      items,
      raw: {
        segmentation: segmentationData,
        nutrition: nutritionData
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "服务异常", detail: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API proxy listening on http://localhost:${port}`);
});
