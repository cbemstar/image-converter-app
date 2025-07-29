export interface Preset {
  id: string;
  name: string;
  width: number;
  height: number;
  bleed?: number;
  safe?: number;
}

class PresetManager {
  private presets: Record<string, Preset> | null = null;

  private async loadPresets() {
    if (this.presets) return;
    const modules = import.meta.glob('../presets/*.json', { eager: true }) as Record<string, Preset>;
    this.presets = {};
    for (const path in modules) {
      const preset = (modules[path] as any).default || modules[path];
      this.presets[preset.id] = preset;
    }
  }

  async getAll(): Promise<Preset[]> {
    await this.loadPresets();
    return Object.values(this.presets!);
  }

  async getById(id: string): Promise<Preset | undefined> {
    await this.loadPresets();
    return this.presets![id];
  }
}

export default new PresetManager();
