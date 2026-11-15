/** Mouse intent is separate from browser capture so unsupported pointer lock
 * still has playable controls, without turning UI clicks into shots. */
export class PointerInput {
  firing = false;
  aiming = false;
  private dragButton: number | null = null;
  private x = 0;
  private y = 0;
  reset() {
    this.firing = this.aiming = false;
    this.dragButton = null;
  }
  down(
    button: number,
    x: number,
    y: number,
    options: {
      active: boolean;
      canvas: boolean;
      locked: boolean;
      weapon: boolean;
    },
  ) {
    if (!options.active || !options.canvas || ![0, 2].includes(button))
      return false;
    if (button === 0 && options.weapon) this.firing = true;
    if (button === 2 && options.weapon) this.aiming = true;
    if (
      !options.locked &&
      ((button === 0 && !options.weapon) || button === 2)
    ) {
      this.dragButton = button;
      this.x = x;
      this.y = y;
    }
    return true;
  }
  up(button: number) {
    if (button === 0) this.firing = false;
    if (button === 2) this.aiming = false;
    if (this.dragButton === button) this.dragButton = null;
  }
  move(
    x: number,
    y: number,
    movementX: number,
    movementY: number,
    buttons: number,
    active: boolean,
    locked: boolean,
  ): [number, number] | null {
    if (!active) {
      this.reset();
      return null;
    }
    if (!(buttons & 1)) this.up(0);
    if (!(buttons & 2)) this.up(2);
    if (locked) return [movementX, movementY];
    if (this.dragButton === null) return null;
    const delta: [number, number] = [x - this.x, y - this.y];
    this.x = x;
    this.y = y;
    return delta;
  }
}
