const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OUTPUT_PATH = path.join(__dirname, '..', 'js', 'public-config.js');

describe('generate-public-config', () => {
  beforeAll(() => {
    const env = {
      ...process.env,
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key'
    };
    const result = spawnSync('node', ['scripts/generate-public-config.js'], {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      env
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout);
    }
  });

  afterAll(() => {
    if (fs.existsSync(OUTPUT_PATH)) {
      fs.unlinkSync(OUTPUT_PATH);
    }
  });

  test('writes js/public-config.js with env values', () => {
    const content = fs.readFileSync(OUTPUT_PATH, 'utf8');
    expect(content).toContain('SUPABASE_URL');
    expect(content).toContain('https://example.supabase.co');
    expect(content).toContain('SUPABASE_ANON_KEY');
    expect(content).toContain('anon-key');
  });

  test('vercel headers serve correct content type', () => {
    const vercel = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8')
    );
    const rule = vercel.headers.find(
      (h) => h.source === '/js/public-config.js'
    );
    expect(rule).toBeTruthy();
    const header = rule.headers.find((h) => h.key === 'Content-Type');
    expect(header.value).toBe('application/javascript');
  });
});

