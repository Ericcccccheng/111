const path = require('path');
const isDev = think.env === 'development';

module.exports = [
  {
    handle: 'meta',
    options: {
      logRequest: isDev,
      sendResponseTime: isDev
    }
  },
  {
    handle: 'cors',
    options: {
      origin: (ctx) => {
        const origin = ctx.header.origin || '';
        const allow = [
          'http://localhost:5173',                   // 本地开发
          'https://你的前端域名.vercel.app'             // 线上前端
        ];
        return allow.includes(origin) ? origin : ''; // 不匹配就不回 CORS 头
      },
      methods: 'GET,POST,PUT,DELETE,OPTIONS',
      headers: 'Content-Type,Authorization',
      credentials: true,            // 要带 cookie/凭证就必须是“回显”具体 origin，不能是 '*'
      maxAge: 86400
    }
  },

  {
    handle: 'resource',
    enable: isDev,
    options: {
      root: path.join(think.ROOT_PATH, 'www'),
      publicPath: /^\/(static|favicon\.ico)/
    }
  },
  {
    handle: 'trace',
    enable: !think.isCli,
    options: {
      debug: isDev
    }
  },
  {
    handle: 'payload',
    options: {
      keepExtensions: true,
      limit: '5mb'
    }
  },
  {
    handle: 'router',
    options: {}
  },
  'logic',
  'controller'
];
