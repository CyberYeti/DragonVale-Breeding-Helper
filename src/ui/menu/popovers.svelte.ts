// Which page-header popover is open (Filters, Display). One at a time:
// opening one closes the other. Resets on reload.

class Popovers {
  /** The open popover's id, or null. */
  open: string | null = $state(null);

  toggle(id: string): void {
    this.open = this.open === id ? null : id;
  }

  /** Closes `id` if it is the open one. */
  close(id: string): void {
    if (this.open === id) this.open = null;
  }
}

export const popovers = new Popovers();
