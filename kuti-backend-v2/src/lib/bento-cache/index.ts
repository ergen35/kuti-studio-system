import { BentoCache, bentostore } from 'bentocache';
import { memoryDriver } from 'bentocache/drivers/memory';
import { redisBusDriver, redisDriver } from 'bentocache/drivers/redis';

export const bento = new BentoCache({
  default: 'defaultCache',
  stores: {
    defaultCache: bentostore().useL1Layer(
      memoryDriver({ maxSize: '20mb' })
    ),
    multitier: bentostore()
      .useL1Layer(memoryDriver({ maxSize: '20mb' }))
      .useL2Layer(
        redisDriver({
          connection: { path: String(process.env.REDIS_URL) },
        })
      )
      .useBus(
        redisBusDriver({
          connection: { path: String(process.env.REDIS_URL) },
        })
      ),
  },
});
