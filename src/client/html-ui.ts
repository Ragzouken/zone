export class HTMLUI {
    readonly windowElements = new Set<HTMLElement>();
    readonly idToWindowElement = new Map<string, HTMLElement>();

    hideAllWindows() {
        this.windowElements.forEach((element) => (element.hidden = true));
    }

    showWindowById(id: string) {
        const windowElement = this.idToWindowElement.get(id);
        if (windowElement) windowElement.hidden = false;
    }

    hideWindowById(id: string) {
        const windowElement = this.idToWindowElement.get(id);
        if (windowElement) windowElement.hidden = true;
    }

    hideWindowByElement(windowElement: HTMLElement) {
        windowElement.hidden = true;
    }

    addElementsInRoot(root: HTMLElement) {
        const windowElements = root.querySelectorAll<HTMLElement>('[data-window]');

        windowElements.forEach((windowElement) => {
            // prettier-ignore
            const windowId =
                   getAttributeOrUndefined(windowElement, 'data-window') 
                || getAttributeOrUndefined(windowElement, 'id') 
                || '';

            this.windowElements.add(windowElement);
            this.idToWindowElement.set(windowId, windowElement);

            const dragElements = windowElement.querySelectorAll<HTMLElement>('[data-window-drag]');
            dragElements.forEach((handleElement) => dragHandle(handleElement, windowElement));
        });

        const closeElement = root.querySelectorAll<HTMLElement>('[data-window-close]');

        closeElement.forEach((closeElement) => {
            const targetId = getAttributeOrUndefined(closeElement, 'data-window-close');

            closeElement.addEventListener('click', (event) => {
                killEvent(event);

                if (targetId) {
                    this.hideWindowById(targetId);
                } else {
                    const parentWindowElement = closeElement.closest<HTMLElement>('[data-window]');
                    if (parentWindowElement) this.hideWindowByElement(parentWindowElement);
                }
            });
        });
    }
}

export function getAttributeOrUndefined(element: HTMLElement, qualifiedName: string) {
    const value = element.getAttribute(qualifiedName) || '';
    return value.length > 0 ? value : undefined;
}

export function killEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
}

export function dragHandle(handleElement: HTMLElement, draggedElement: HTMLElement) {
    let offset: number[] | undefined;

    handleElement.addEventListener('click', killEvent);
    handleElement.addEventListener('pointerdown', (event) => {
        killEvent(event);

        const dx = draggedElement.offsetLeft - event.clientX;
        const dy = draggedElement.offsetTop - event.clientY;
        offset = [dx, dy];
    });

    window.addEventListener('pointerup', (event) => {
        offset = undefined;
    });

    window.addEventListener('pointermove', (event) => {
        if (!offset) return;

        killEvent(event);

        const [dx, dy] = offset;
        const tx = event.clientX + dx;
        const ty = event.clientY + dy;

        let minX = tx;
        let minY = ty;

        const maxX = minX + draggedElement.clientWidth;
        const maxY = minY + draggedElement.clientHeight;

        const shiftX = Math.min(0, window.innerWidth - maxX);
        const shiftY = Math.min(0, window.innerHeight - maxY);

        minX = Math.max(0, minX + shiftX);
        minY = Math.max(0, minY + shiftY);

        draggedElement.style.left = minX + 'px';
        draggedElement.style.top = minY + 'px';
    });
}
