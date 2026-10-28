/**
 * Writes the pointer position into `--mx` / `--my` on the hovered element, which
 * the `.spotlight` styles in `globals.css` use to place the glow. A plain handler
 * rather than a hook, so a card can stay a server-friendly function component.
 */
export function trackPointer(event) {
    const node = event.currentTarget;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    node.style.setProperty('--my', `${event.clientY - rect.top}px`);
}
