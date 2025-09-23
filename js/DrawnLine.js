import { Point } from './Point.js';
import { PenOptions } from './PenOptions.js';

export class DrawnLine {
  constructor(start = new Point(), end = new Point(), penOptions = new PenOptions()) {
    this.start = start;
    this.end = end;
    this.penOptions = penOptions;
  }

  static fromObject(value) {
    if (!value || typeof value !== 'object') {
      return new DrawnLine();
    }

    const start = Point.fromObject(value.start);
    const end = Point.fromObject(value.end);
    const penOptions = PenOptions.fromObject(value.penOptions);
    return new DrawnLine(start, end, penOptions);
  }

  toJSON() {
    return {
      start: { ...this.start },
      end: { ...this.end },
      penOptions: this.penOptions.toJSON()
    };
  }
}
