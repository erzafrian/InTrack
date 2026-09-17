const app = require('./app');
const config = require('./config/env');

app.listen(config.port, () => {
  console.log(`[InTrack] Server running on port ${config.port}`);
  console.log(`[InTrack] Environment: ${config.nodeEnv}`);
});
