module.exports = {
  apps: [
    {
      name: 'nexusfx-backend',
      script: 'server.js',
      instances: 'max', // or a specific number of instances
      exec_mode: 'cluster', // enables cluster mode for Node.js
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    }
  ]
};
