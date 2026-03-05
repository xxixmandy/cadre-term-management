# 干部任期管理系统

## 部署说明

### 1. 环境变量配置

在 Vercel 部署时需要设置以下环境变量：

```
NEXT_PUBLIC_SUPABASE_URL=https://ricgjhawcvgkqoqlhcol.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpY2dqaGF3Y3Zna3FvcWxoY29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTc4NzAsImV4cCI6MjA4Nzk3Mzg3MH0.HI5fKoo5gDEoGUfOx3Hd49DnIgiLHYsMLq8Z4UEI_HU
```

### 2. 本地运行

```bash
pnpm install
pnpm dev
```

### 3. 部署到 Vercel

1. 将代码上传到 GitHub
2. 在 Vercel 导入 GitHub 仓库
3. 添加环境变量
4. 点击 Deploy
