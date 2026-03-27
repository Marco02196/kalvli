# 食物热量计算器 H5

本项目包含：
- H5 前端页面（拍照识别 + 热量/营养素估算）
- OpenAI 图像分析代理服务（优先）
- LogMeal API 代理服务（可选备用）

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

复制 `.env.example` 为 `.env`。

- 推荐填写 `OPENAI_API_KEY`，会启用 OpenAI 图像分析提升识别成功率。
- 可选填写 `OPENAI_MODEL`，默认是 `gpt-4.1-mini`。
- 可选填写 `LOGMEAL_APIUSER_TOKEN`，作为 OpenAI 失败时的备用识别通道。
- 如果一个密钥都没填，服务会返回模拟识别结果。

3. 启动代理服务

```bash
npm start
```

4. 打开前端页面

浏览器访问 `http://localhost:3000`，识别按钮将调用 `http://localhost:3000/api/recognize`。

5. 运行测试脚本

```bash
npm test
```

## 部署建议

- 前端：上传 `index.html`、`styles.css`、`app.js`、`assets/`、`manifest.json` 到任意静态托管（对象存储、CDN、静态站点）。
- 后端：将 `server.js` 部署到你的 Node 运行环境（云函数/服务器），并设置环境变量。
- 上线后，确保 `app.js` 里的 `RECOGNITION_ENDPOINT` 指向线上代理地址。

## Render 部署示例

1. 将项目推到 Git 仓库（GitHub/GitLab 均可）。
2. Render 新建 Web Service，选择该仓库。
3. 环境选择 `Node`，Start Command 填 `npm start`。
4. 环境变量中优先新增 `OPENAI_API_KEY`，可选再加 `OPENAI_MODEL` 和 `LOGMEAL_APIUSER_TOKEN`。
5. 部署完成后得到线上地址，如 `https://your-service.onrender.com`。
6. 前端页面里保存识别地址：`https://your-service.onrender.com/api/recognize`。

## 说明

识别顺序为：`OpenAI -> LogMeal -> mock`。

识别结果与营养素为估算值，仅作参考。
