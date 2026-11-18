import { Logger } from '@nestjs/common';
import { createApp } from './bootstrap';

async function main() {
  const { app, config } = await createApp();
  await app.listen(config.port, '127.0.0.1');
  new Logger('NEXUS').log(`API NEXUS LOGISTICS OS escuchando en http://127.0.0.1:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
