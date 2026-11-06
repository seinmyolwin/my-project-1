export const createTombstone = (reason: string, userId?: string) => ({
  deletedAt: new Date().toISOString(),
  deletedReason: reason,
  deletedBy: userId,
  updatedAt: new Date().toISOString(),
});

export const SAMPLE_AGENT_DIGESTS = [
  "d62d223fa9e1b985a96a568d8ec8f35928e7e0fc267a547569e6345f1d37f38a",
  "91aebfdc85c0874b00f2c1bd64ff72e3511de465695dbee0e06560232243b978",
  "4b603af1b82d4fffb0fd3603b76dd7bec62081a16836aa21a331da5cc2bb2233",
  "9b4676c7e08f1849defb6c17a42309379cc399e8df752f6b7476444b427384f1",
  "9dd5881897328a7549fb4172d179aee06b08cf9913c88d0072cb376c6dff6e80",
  "deb5c78b401b11a30f03e80810e3fcdb4c04d36164fb9a1d03f5e8b7059d27e8",
  "41eb7a19ca59609f25c8b257fa597b9f11187eeb82774c31e2ecd82cedba9769",
  "d5f07f728f56b907755f4727204eabd926bab9909aadf40411a170279eb5f7f3",
  "a1480acf964de3259a4493c5f889f9fdecf9df8b170d4da88055b972d19c0e75",
  "591c56dfc3ef198e22381d3758828752eb34e6df0808ed1773a3a440e429e6d7",
  "ebac5d6cbbc11471fb69d3f43c64d55bfb17d3808382e2c5ff0fac64e3144dc2",  "b642d722109fe7d9d2ca8cb56d4a9b3f3890303f1a86d9500ec46bd9c6fa8ad7",
  "e6173f0ff15548878355a4b7ff6c7d9b14fb22096c71067702a76a5caac8e52d",
  "c12a302361e1e94040a53dfd3cef3104f344261aced9c92aea19e528a6fce07a",
  "a7ea4df3afe66f2a3b6066aa1266e349b58112c755862ef7f0e95cec456da0b6",
  "95cffb54c6e690fd955ed2c3ebc08d775438b903d28b09b1ad2121886b982c10"
];

export async function computeSha256Digest(str: string): Promise<string> {
  const subtle = (typeof crypto !== 'undefined' && crypto.subtle)
    ? crypto.subtle
    : (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle)
      ? (globalThis as any).crypto.subtle
      : null;

  if (subtle) {
    const data = new TextEncoder().encode(str);
    const hashBuf = await subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

export async function isSampleAgentDigest(name?: string, phone?: string): Promise<boolean> {
  const cleanName = (name || '').trim();
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanName && !cleanPhone) return false;

  const fullHash = await computeSha256Digest(`${cleanName}|${cleanPhone}`);
  if (SAMPLE_AGENT_DIGESTS.includes(fullHash)) return true;

  if (cleanName) {
    const nameHash = await computeSha256Digest(`${cleanName}|`);
    if (SAMPLE_AGENT_DIGESTS.includes(nameHash)) return true;
  }

  if (cleanPhone) {
    const phoneHash = await computeSha256Digest(`|${cleanPhone}`);
    if (SAMPLE_AGENT_DIGESTS.includes(phoneHash)) return true;
  }

  return false;
}

export async function purgeSampleAgentsAndPhones(): Promise<number> {
  let purgedCount = 0;
  try {
    const rawAgents = localStorage.getItem('shwe_master_agents_list');
    if (rawAgents) {
      const parsed = JSON.parse(rawAgents);
      if (Array.isArray(parsed)) {
        const kept: any[] = [];
        for (const agent of parsed) {
          const isSample = await isSampleAgentDigest(agent?.name, agent?.phone);
          if (isSample) {
            purgedCount++;
          } else {
            kept.push(agent);
          }
        }
        localStorage.setItem('shwe_master_agents_list', JSON.stringify(kept));
      }
    }
  } catch {
    // ignore
  }
  return purgedCount;
}
