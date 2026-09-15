const app = require('./app');
const config = require('./config/env');

app.listen(config.port, () => {
  console.log(`[GetAbsen] Server running on port ${config.port}`);
  console.log(`[GetAbsen] Environment: ${config.nodeEnv}`);
});
