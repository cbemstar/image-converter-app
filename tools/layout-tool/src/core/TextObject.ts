export interface TextObject {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  family: string;
  weight: string;
  size: number;
  colour: string;
  tracking: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right' | 'justify';
}

export type TextStyle = Pick<TextObject,
  'family' | 'weight' | 'size' | 'colour' | 'tracking' | 'lineHeight' | 'align'>;
