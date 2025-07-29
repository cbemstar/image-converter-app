import { describe, it, expect } from 'vitest';
import PresetManager from './PresetManager';

describe('PresetManager', () => {
  it('loads all presets', async () => {
    const presets = await PresetManager.getAll();
    expect(presets.length).toBeGreaterThan(0);
  });

  it('retrieves preset by id', async () => {
    const preset = await PresetManager.getById('poster-a4');
    expect(preset).toBeDefined();
    expect(preset!.bleed).toBe(3);
  });
});
