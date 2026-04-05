const {join} = require('path');
module.exports = {
  // Mueve la caché de Puppeteer al directorio del proyecto para que Render lo preserve y lo encuentre
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
