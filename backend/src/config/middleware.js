// backend/src/config/middleware.js
const path = require('path');

const isDev  = think.env === 'development';
const isProd = !isDev;

module.exports = [
  'meta',

  // 静态资源（可选）
  {
    handle: 'resource',
    enable: isDev,
    options: {
      root: path.join(think.ROOT_PATH, 'www'),
      publicPath: /^\/(static|favicon\.ico)/
    }
  },

  { handle: 'payload', options: { jsonLimit: '5mb', keepExtensions: true } },

  // ★ CORS：开发期 '*'+无凭证；线上用白名单+凭证
  {
    handle: 'cors',
    options: isProd
      ? {
          origin: (ctx) => {
            const o = ctx.header.origin || '';
            const allow = [
              // 把下面这个换成你 Vercel 的域名
              'https://job-web-rho.vercel.app'
            ];
            return allow.includes(o) ? o : '';
          },
          credentials: true,
          methods: 'GET,POST,PUT,DELETE,OPTIONS',
          headers: 'Content-Type,Authorization',
          maxAge: 86400
        }
      : {
          origin: '*',
          credentials: false,
          methods: 'GET,POST,PUT,DELETE,OPTIONS',
          headers: 'Content-Type,Authorization',
          maxAge: 86400
        }
  },

  'router',
  'logic',
  'controller'
];
