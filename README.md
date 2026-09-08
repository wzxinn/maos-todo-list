# maos'todo · 研发调度中枢

前后端分离工程（不再单文件 / 不再 CDN）：

```
maos-worklist/
├─ server/           后端 Node（http + JSON 存储，零第三方依赖）
│   └─ server.js     API + 静态托管 web/dist
├─ web/              前端 Vue3 + Vite + Element Plus + ECharts（npm 本地依赖）
│   ├─ src/App.vue   单页应用（模板/逻辑/样式，SFC）
│   ├─ index.html    Vite 入口
│   └─ package.json  依赖清单
└─ data/db.json      JSON 数据（首次启动自动播种演示数据）
```

## 离线使用（依赖已装过一次即可全离线）

前置：已安装 Node.js。前端依赖安装在本地 `web/node_modules`，不再访问任何 CDN；echarts / element-plus / vue 全部来自 node_modules。

### 开发模式（热更新）
```bash
# 终端 1：后端 API（端口 24680）
node server/server.js

# 终端 2：前端 dev server（端口 5173，/api 自动代理到 24680）
cd web && npm install && npm run dev
# 浏览器打开 http://localhost:5173
```

### 生产模式（单端口）
```bash
cd web && npm install && npm run build   # 生成 web/dist
node server/server.js                     # 打开 http://localhost:24680
```

### 数据
- 数据文件：`data/db.json`
- 重置演示数据：`node server/server.js --reset`
- 常用登录身份：张伟 / 李娜 / 王强 / 赵敏 / 陈晨 / 刘洋
- 调试直进：`http://localhost:24680/?as=张伟#/me`

> 若以旧版运行方式（直接 `node server.js`）启动的是遗留的旧单文件版本，
> 请删除根目录下旧的 `server.js` / `start.*`（见下文清理）后按上面新方式运行。
