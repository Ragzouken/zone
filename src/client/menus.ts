import { EventEmitter } from "events";
import { timeStamp } from "console";

export class Menu extends EventEmitter {
    tabToggles = new Map<string, HTMLElement>();
    tabBodies = new Map<string, HTMLElement>();

    constructor() {
        super();
    }

    open(path: string) {
        if (path.includes('/'))
            this.open(getPathParent(path));

        this.tabToggles.forEach((toggle, toggleId) => {
            if (arePathsSiblings(path, toggleId))
                toggle.classList.toggle('active', toggleId === path);
        });
        this.tabBodies.forEach((body, bodyId) => {
            if (arePathsSiblings(path, bodyId))
                body.hidden = (bodyId !== path);
        });

        this.emit(`open:${path}`);
    }

    close(path: string) {
        const tab = this.tabToggles.get(path);
        const body = this.tabBodies.get(path);

        if (tab) tab.classList.toggle('active', false);
        if (body) body.hidden = true;

        this.emit(`close:${path}`);
    }

    closeChildren(path: string) {
        this.tabToggles.forEach((toggle, togglePath) => {
            if (getPathParent(togglePath) === path)
                this.close(togglePath);
        });
    }
}

export function menusFromDataAttributes(root: HTMLElement) {
    const menu = new Menu();
    menu.tabToggles = indexByDataAttribute(root, 'data-tab-toggle');
    menu.tabBodies = indexByDataAttribute(root, 'data-tab-body');

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
