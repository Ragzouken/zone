import { EventEmitter } from 'events';
import { timeStamp } from 'console';

export class Menu extends EventEmitter {
    paths = new Set<string>();
    tabToggles = new Map<string, HTMLElement>();
    tabBodies = new Map<string, HTMLElement>();

    readonly visible = new Map<string, boolean>();

    constructor() {
        super();
    }

    private setShown(path: string, shown: boolean) {
        const tab = this.tabToggles.get(path);
        const body = this.tabBodies.get(path);

        if (tab) tab.classList.toggle('active', shown);
        if (body) body.hidden = !shown;
    }

    isVisible(path: string): boolean {
        const ancestors = !path.includes('/') || this.isVisible(getPathParent(path));
        return ancestors && !this.tabBodies.get(path)?.hidden;
    }

    open(path: string) {
        if (path.includes('/')) this.open(getPathParent(path));

        this.paths.forEach((other) => {
            if (arePathsSiblings(path, other)) this.setShown(other, other === path);
        });

        this.refresh();
        this.emit(`open:${path}`);
    }

    close(path: string) {
        const tab = this.tabToggles.get(path);
        const body = this.tabBodies.get(path);

        if (tab) tab.classList.toggle('active', false);
        if (body) body.hidden = true;

        this.refresh();
        this.emit(`close:${path}`);
    }

    closeChildren(path: string) {
        this.tabToggles.forEach((toggle, togglePath) => {
            if (getPathParent(togglePath) === path) this.close(togglePath);
        });
    }

    refresh() {
        this.paths.forEach((path) => {
            const prev = this.visible.get(path) === true;
            const next = this.isVisible(path);

            if (prev !== next) this.emit(`${next ? 'show' : 'hide'}:${path}`);

            this.visible.set(path, next);
        });
    }
}

export function menusFromDataAttributes(root: HTMLElement) {
    const menu = new Menu();
    menu.tabToggles = indexByDataAttribute(root, 'data-tab-toggle');
    menu.tabBodies = indexByDataAttribute(root, 'data-tab-body');
    menu.tabToggles.forEach((_, path) => menu.paths.add(path));
    menu.tabBodies.forEach((_, path) => menu.paths.add(path));

    menu.tabToggles.forEach((toggle, path) => {
        toggle.addEventListener('click', (event) => {
            event.stopPropagation();

            if (toggle.classList.contains('active')) {
                menu.close(path);
            } else {
                menu.open(path);
            }
        });
    });

    return menu;
}

function arePathsSiblings(idA: string, idB: string) {
    return getPathParent(idA) === getPathParent(idB);
}

function getPathParent(id: string) {
    const components = id.split('/');
    return components.slice(0, -1).join('/');
}

function indexByDataAttribute(root: HTMLElement, attribute: string) {
    const index = new Map<string, HTMLElement>();
    root.querySelectorAll(`[${attribute}]`).forEach((element) => {
        const value = element.getAttribute(attribute);
        if (value !== null) index.set(value, element as HTMLElement);
    });
    return index;
}
