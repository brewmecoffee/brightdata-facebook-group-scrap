module.exports = {
  apps: [{
    name: 'facebook-scraper-frontend',
    script: 'serve',
    env: {
      PM2_SERVE_PATH: './build',
      PM2_SERVE_PORT: 3002,
      PM2_SERVE_SPA: 'true',
      PM2_SERVE_HOMEPAGE: '/index.html'
    }
  }, {
    name: 'facebook-scraper-backend',
    cwd: './server',
    script: 'server.js',
    env: {
      PORT: 5000,
      NODE_ENV: 'production'
    }
  }]
};
