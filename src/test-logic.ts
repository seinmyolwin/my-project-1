import { createRestorePoint } from './utils/restorePoints';

async function runTests() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    key: (i: number) => Array.from(store.keys())[i] || null,
    get length() { return store.size; }
  };
  (global as any).localStorage = storage;
  
  storage.setItem('telegram_config', '{"api_id": 12345}');
  storage.setItem('raw_text_clips', JSON.stringify([
    { id: 1, customerPhone: '0912345678', content: 'test' },
    { id: 2, customerPhone: '0987654321', content: 'hello' }
  ]));
  storage.setItem('other_key', 'normal_value');

  console.log('--- Starting tests ---');

  const point = await createRestorePoint('manual');

  // Test Exclusion
  console.log('Test Exclusion (telegram):', !point.keys['telegram_config'] && point.excludedKeys.includes('telegram_config'));

  // Test Redaction
  const rawClips = JSON.parse(point.keys['raw_text_clips']);
  const phoneRedacted = rawClips.every((c: any) => c.customerPhone === '');
  console.log('Test Redaction (customerPhone):', phoneRedacted && point.redacted && point.redactedKeys.includes('raw_text_clips'));

  // Test Verification
  console.log('Test Verification (redacted data):', !!point.hashes && !!point.hashes['raw_text_clips']);
  
  // Tamper test (optional, manually verify or just rely on SHA-256)
  console.log('Tests completed.');
}

runTests().catch(console.error);
