# peace-todo-standalone

ZenTask + ZenFit 个人生活记录应用 — 任务管理与训练记录二合一。从 Lovable 迁移出来的独立部署版本,前端 React + Vite,后端 Supabase。

## 功能

- **ZenTask**(`/task`):任务 CRUD、优先级(高/中/低)、截止日期、已完成筛选与清空
- **ZenFit**(`/fit`):跑步/游泳/专项游泳组/力量训练记录,历史按天分组,周/月统计(次数、时长、距离、估算卡路里),单位偏好(km/mi、kg/lb、m/yd)存数据库
- **登录**:邮箱密码注册/登录,忘记密码(重置邮件)流程
- **Dashboard**(`/`):两模块入口,记录上次使用的模块

## 技术栈

- React 18 + TypeScript + Vite 5
- Tailwind CSS(shadcn/ui 风格,自维护组件)
- TanStack Query(挂载,业务暂以手写 state 为主)
- Supabase(auth + Postgres,RLS 策略在 `supabase/migrations/`)

## 本地开发

```bash
npm install
npm run dev       # 开发服务器
npm test          # vitest
npm run build     # 生产构建
```

### 环境变量

复制 `.env.example` 为 `.env.local`,填入 Supabase 项目 URL 与 anon key:

```
VITE_SUPABASE_URL="https://<project>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
```

> `VITE_SUPABASE_PROJECT_ID` 仅示例文件中的占位说明,代码未使用。

## 数据库

- 迁移文件:`supabase/migrations/*.sql`(建表、RLS、索引、触发器、外键)
- 表:`tasks`、`workouts`、`user_preferences`,均启用 RLS(仅本人可读写)
- 变更流程:改迁移 → `supabase db push` → `supabase gen types typescript` 更新 `src/integrations/supabase/types.ts`

## 部署

- 前端:Vercel 自动部署(见 `vercel.json` 的 SPA fallback rewrite)
- 生产地址:https://peace-todo-standalone.vercel.app
- Supabase 侧:Site URL 与 Auth 重定向白名单需包含生产域名

## 运维备忘

- **DB 密码**:新版 Supabase dashboard 不显示密码;连接串在项目页右上角 **Connect**。密码仅存于本地脚本(已 gitignore),丢失需在 dashboard 重置
- **数据备份**:旧站备份快照在 `scripts/lovable-export/backup-2026-08-06.json`(gitignore 保护)
- **迁移脚本**:`scripts/lovable-export/` 下的 check-users.mjs 等工具使用 DB 密码,不入库

## 相关链接

- 新 app:https://peace-todo-standalone.vercel.app
- 新 repo:https://github.com/becki01-dev/peace-todo-standalone
- 旧 repo(存档):https://github.com/becki01-dev/peace-todo
- 旧 app(已下架):https://peace-todo.lovable.app
