const KEY_ICONS: Record<string, string> = {
  ctrl: "ctrl",
  control: "ctrl",
  shift: "⇧",
  alt: "alt",
  cmd: "⌘",
  option: "alt",
  command: "⌘",
  meta: "⌘",
  enter: "↵",
  space: "space",
  backspace: "⌫",
  escape: "esc",
};

export class Shortcut {
  constructor(private readonly shortcutKeys: string[]) {}

  static keyToIcon(key: string): string {
    if (key.startsWith("Key")) {
      return key.slice(3);
    }
    return KEY_ICONS[key.toLowerCase()] || key;
  }

  getKeysIcons(): string {
    return this.shortcutKeys.map(Shortcut.keyToIcon).join("+");
  }

  get keys(): string[] {
    return this.shortcutKeys;
  }

  keyIcon(key: string): string {
    return Shortcut.keyToIcon(key);
  }
}

export function getShortcut(shortcut: string[]): Shortcut {
  return new Shortcut(shortcut);
}
