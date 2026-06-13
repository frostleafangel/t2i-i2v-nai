# NewBie Anime Generator

NewBie Anime Generator 是一个面向 AI 图像/视频生成工作流的 Web 应用。项目包含 React + TypeScript 前端、Express 后端代理、用户登录、画廊、收藏、生成历史、数据分析、NovelAI、ComfyUI 标准/双人/视频等功能模块。

## 技术栈

- 前端：React 19、TypeScript、Vite、Tailwind CSS、React Router、Recharts
- 后端：Node.js、Express、SQLite、Session、Multer、Sharp
- AI/生成服务：ComfyUI、NovelAI、Gemini、SiliconFlow

## 目录结构

```text
.
├── App.tsx / index.tsx          # 前端入口与主应用
├── components/                  # 通用组件与功能组件
├── contexts/                    # React Context
├── locales/                     # 中英文文案
├── pages/                       # 页面组件
├── public/                      # 静态资源
├── server/                      # Express API、数据库、上传与服务脚本
├── services/                    # 前端服务封装
├── src/                         # 样式与 Vite 类型声明
├── package.json                 # 前端依赖与脚本
└── server/package.json          # 后端依赖与脚本
```

## 本地运行

### 环境要求

- Node.js 20+ 推荐
- npm
- 可访问的 ComfyUI / NovelAI / 其他 AI 服务（按需配置）

### 1. 安装依赖

```bash
npm install
cd server && npm install
```

### 2. 配置环境变量

复制示例文件：

```bash
cp .env.example .env.local
```

按需填写 `.env.local` / `.env.server`，这些文件包含本地地址、密钥或服务端配置，已经被 `.gitignore` 排除，不能提交到 GitHub。

常见变量：

```env
VITE_COMFY_URL=http://localhost:8188
VITE_COMFY_URL_STANDARD=http://localhost:8189
SESSION_SECRET=change-me
NOVELAI_API_KEY=your_novelai_key
SILICONFLOW_API_KEY=your_siliconflow_key
GEMINI_API_KEY=your_gemini_key
```

### 3. 启动开发服务

前端：

```bash
npm run dev
```

后端：

```bash
npm start
```

或者进入后端目录单独启动：

```bash
cd server
npm start
```

### 4. 构建生产包

```bash
npm run build
```

构建产物输出到 `dist/`，该目录不需要提交到 GitHub。

## GitHub 上传范围

### 应该提交

- 源码：`*.tsx`、`*.ts`、`server/**/*.js`
- 配置：`package.json`、`package-lock.json`、`server/package.json`、`server/package-lock.json`、`vite.config.ts`、`tsconfig.json`、`tailwind.config.js`、`postcss.config.js`
- 静态资源与公开数据：`public/`、`src/`、`locales/`、`docs/`、`scripts/`
- 环境变量模板：`.env.example`
- 占位文件：`server/uploads/.gitkeep`，如创建 `server/data/.gitkeep` 也可以提交
- 项目说明：`README.md`

### 不应该提交

- 依赖目录：`node_modules/`、`server/node_modules/`
- 构建产物：`dist/`、`dist-ssr/`
- 私密环境变量：`.env.local`、`.env.server`、`.env`、任何 `.env.*`（除 `.env.example`）
- 数据库与运行数据：`server/database.sqlite`、`server/data/*`
- 用户上传/生成内容：`server/uploads/*`（保留 `.gitkeep`）
- 日志与调试文件：`*.log`、`server/debug*.txt`
- 本地部署配置、备份和压缩包：`archive/`、`nginx*.conf`、`*.bak`、`*.tar.gz`、`*.zip`

## 上传到 GitHub 前检查

```bash
git status --short --ignored
```

确认没有密钥、数据库、上传图片、构建产物和依赖目录进入暂存区后再提交：

```bash
git add .
git status --short
git commit -m "Initial project upload"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

> 注意：如果仓库已经有远程地址，请不要重复执行 `git remote add origin`，改用 `git remote -v` 检查或 `git remote set-url origin <your-github-repo-url>` 更新。

## 安全注意事项

- 不要提交真实 API Key、Cookie、Session Secret、数据库文件或用户生成图片。
- 如果敏感文件曾经被提交过，需要在推送前清理 Git 历史。
- 生产环境请设置强随机 `SESSION_SECRET`，并根据实际 HTTPS / 反向代理环境检查 Cookie 配置。
