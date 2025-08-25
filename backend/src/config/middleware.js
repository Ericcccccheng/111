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
    options: isProd
      // 线上：白名单 + 凭证
      ? {
          origin: (ctx) => {
            const origin = ctx.header.origin || '';
            const allow = [
              'https://<你的vercel项目名>.vercel.app'
            ];
            return allow.includes(origin) ? origin : '';
          },
          credentials: true,
          methods: 'GET,POST,PUT,DELETE,OPTIONS',
          headers: 'Content-Type,Authorization',
          maxAge: 86400
        }
      // 本地：无需凭证，直接 *
      : {
          origin: '*',
          credentials: false,
          methods: 'GET,POST,PUT,DELETE,OPTIONS',
          headers: 'Content-Type,Authorization',
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
