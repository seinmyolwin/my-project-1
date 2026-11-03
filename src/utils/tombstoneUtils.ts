export const createTombstone = (reason: string, userId?: string) => ({
  deletedAt: new Date().toISOString(),
  deletedReason: reason,
  deletedBy: userId,
  updatedAt: new Date().toISOString(),
});

export const SAMPLE_AGENT_NAMES = ['ကိုမင်းအောင်', 'ဒေါ်ခင်သန်း', 'ဦးဘုန်း', 'ကိုစိုးနိုင်'];
export const SAMPLE_AGENT_PHONES = ['09-790002222', '09-450003333', '09-250004444', '09-970001111', '09790002222', '09450003333', '09250004444', '09970001111'];

export function purgeSampleAgentsAndPhones(): void {
  try {
    const rawAgents = localStorage.getItem('shwe_master_agents_list');
    if (rawAgents) {
      const parsed = JSON.parse(rawAgents);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((agent: any) => {
          const name = agent.name || '';
          const phone = agent.phone || '';
          const isSampleName = SAMPLE_AGENT_NAMES.some(s => name.includes(s));
          const isSamplePhone = SAMPLE_AGENT_PHONES.some(p => phone.includes(p));
          return !isSampleName && !isSamplePhone;
        });
        localStorage.setItem('shwe_master_agents_list', JSON.stringify(filtered));
      }
    }
  } catch {
    // ignore
  }
}
