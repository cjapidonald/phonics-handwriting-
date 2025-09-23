export class PenOptions {
  constructor(colour = '#000000', width = 6) {
    this.colour = colour;
    this.width = width;
    this.size = width;
  }

  static fromObject(value) {
    if (!value || typeof value !== 'object') {
      return new PenOptions();
    }

    const colour = typeof value.colour === 'string' ? value.colour : '#000000';
    const rawWidth = value.width ?? value.size;
    const width = Number(rawWidth);
    return new PenOptions(colour, Number.isFinite(width) ? width : 6);
  }

  toJSON() {
    return {
      colour: this.colour,
      width: this.width,
      size: this.size
    };
  }
}
