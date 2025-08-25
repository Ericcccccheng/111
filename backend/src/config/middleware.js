// backend/src/config/middleware.js
const path = require('path');
const cors = require('@koa/cors'); // ← 新增：使用 @koa/cors

const isDev = think.env === 'development';

module.exports = [
  'meta',

  {
    handle: 'resource',
    enable: isDev,
    options: {
      root: path.join(think.ROOT_PATH, 'www'),
      publicPath: /^\/(static|favicon\.ico)/
    }
  },

  { handle: 'payload', options: { jsonLimit: '5mb', keepExtensions: true } },

  // ===== CORS（按环境）=====
  {
    handle: cors, // ← 这里要传“函数”，不能是字符串
    options: isDev
      ? {
          // 本地开发：全部放开，避免预检/白名单问题
          origin: '*',
          credentials: false,
          allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
          maxAge: 86400
        }
      : {
          // 线上：白名单 + 允许 vercel 预览域
          origin: (ctx) => {
            const o = ctx.header.origin || '';
            if (!o) return false;

            const allowFixed = new Set([
              'https://job-web-rho.vercel.app', // 你的前端正式域
              'http://localhost:5173',
              'http://127.0.0.1:5173'
            ]);

            try {
              const { hostname, protocol } = new URL(o);
              if (protocol === 'https:' && hostname.endsWith('.vercel.app')) {
                return o; // 允许所有 preview 环境
              }
            } catch {}

            return allowFixed.has(o) ? o : false;
          },
          credentials: false, // 若要 Cookie，改 true 并在前端 fetch 加 { credentials:'include' }
          allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
          maxAge: 86400
        }
  },

  'router',
  'logic',
  'controller'
];
