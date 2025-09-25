import { Point } from './Point.js';

const DEFAULT_SEGMENT_COLOUR = '#000000';
const DEFAULT_SEGMENT_WIDTH = 6;

export class DrawnLine {
  constructor(start = new Point(), end = new Point(), options = {}) {
    const { width = DEFAULT_SEGMENT_WIDTH, colour = DEFAULT_SEGMENT_COLOUR, tool = 'pen' } = options ?? {};

    this.start = Point.fromObject(start);
    this.end = Point.fromObject(end);
    this.width = Number.isFinite(Number(width)) ? Number(width) : DEFAULT_SEGMENT_WIDTH;
    this.colour = typeof colour === 'string' ? colour : DEFAULT_SEGMENT_COLOUR;
    this.tool = tool === 'eraser' ? 'eraser' : 'pen';
  }

  static fromObject(value) {
    if (value instanceof DrawnLine) {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return new DrawnLine();
    }

    const start = Point.fromObject(value.start);
    const end = Point.fromObject(value.end);

    if (value.penOptions && typeof value.penOptions === 'object') {
      const { colour, width, size } = value.penOptions;
      const resolvedWidth = Number(width ?? size);
      return new DrawnLine(start, end, {
        colour,
        width: Number.isFinite(resolvedWidth) ? resolvedWidth : DEFAULT_SEGMENT_WIDTH,
        tool: value.tool
      });
    }

    return new DrawnLine(start, end, {
      colour: value.colour,
      width: value.width,
      tool: value.tool
    });
  }

  toJSON() {
    return {
      start: { x: this.start.x, y: this.start.y },
      end: { x: this.end.x, y: this.end.y },
      width: this.width,
      colour: this.colour,
      tool: this.tool
    };
  }
}
