export class Point {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  static fromObject(value) {
    if (!value || typeof value !== 'object') {
      return new Point();
    }

    const { x = 0, y = 0 } = value;
    return new Point(Number(x) || 0, Number(y) || 0);
  }
}
