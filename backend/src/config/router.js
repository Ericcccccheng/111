module.exports = [
    ['get', '/api/companies', 'company/index'],
    ['post', '/api/companies', 'company/create'],
    ['get',  '/api/stream',    'stream/index'],
    ['get', '/company/index',   'company/index'],
    ['get', '/company/by-bbox', 'company/bbox'],
    ['get', '/company/by-suburb','company/suburb']
];
