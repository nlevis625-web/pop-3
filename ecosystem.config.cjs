module.exports = {
  apps: [
    {
      name: "pop3",
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production",
        PORT: 8081,
        ALLOWED_HOSTS: "adoonline.online,adoonline.pics",
      },
    },
  ],
};
