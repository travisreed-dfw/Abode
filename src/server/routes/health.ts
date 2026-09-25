import type { Router } from '../router.ts';
import type { AliasRepository } from '../aliases.ts';
import type { UserRepository } from '../users.ts';
import type { Health } from '../../shared/types.ts';

export function healthRoute(router: Router, aliases: AliasRepository, users: UserRepository, docker: { enabled: boolean }, startedAt: number): void {
  router.get('/api/health', (ctx) => {
    const body: Health = {
      ok: true,
      aliases: aliases.count(),
      users: users.count(),
      docker: docker.enabled,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    };
    ctx.json(200, body);
  });
}
