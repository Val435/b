// CommonJS
const app = require('../dist/app.js').default;
const serverless = require('serverless-http');
module.exports = serverless(app);
