module.exports = {
    apps: [
      {
        name: "apiService",
        script: "./services/apiService.js",
        instances: 1,
        autorestart: true,
        watch: false,
      },
      {
        name: "itemService",
        script: "./services/itemService.js",
        instances: 1,
        autorestart: true,
        watch: false,
      },
      {
        name: "sniperService",
        script: "./services/sniperService.js",
        instances: 1,
        autorestart: false,
        watch: false,
      }
    ],
  };
  