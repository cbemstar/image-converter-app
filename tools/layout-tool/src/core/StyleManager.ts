import { TextStyle } from './TextObject';

export type StyleName = 'heading' | 'body';

class StyleManager {
  private styles: Record<StyleName, TextStyle | undefined> = {
    heading: undefined,
    body: undefined,
  };

  constructor() {
    const data = localStorage.getItem('lt-styles');
    if (data) {
      Object.assign(this.styles, JSON.parse(data));
    }
  }

  getStyle(name: StyleName): TextStyle | undefined {
    return this.styles[name];
  }

  saveStyle(name: StyleName, style: TextStyle) {
    this.styles[name] = style;
    localStorage.setItem('lt-styles', JSON.stringify(this.styles));
  }
}

export default new StyleManager();
