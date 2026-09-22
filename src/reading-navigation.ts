import { setIcon } from 'obsidian';
import { strings } from './i18n';
export type { NavigationMarker } from './navigation-model';
export {
	findNextMarker,
	findPreviousMarker,
	getNavigationTargets,
} from './navigation-model';

const POSITION_STORAGE_KEY = 'reading-markers.navigation-position';
const AUTO_COLLAPSE_DELAY_MS = 4000;
const EDGE_SNAP_DISTANCE = 64;

type NavigationSide = 'left' | 'right' | 'free';

interface NavigationPosition {
	side: NavigationSide;
	topPercent: number;
	xPercent: number;
}

export interface NavigationState {
	hasPrevious: boolean;
	centerEnabled: boolean;
	centerTitle?: string;
	hasNext: boolean;
	hasProgress?: boolean;
	detouring?: boolean;
}

export interface NavigationActions {
	goPrevious(): void;
	goCenter(): void;
	goNext(): void;
	openMarkers?(): void;
	resume?(): void;
	continueHere?(): void;
}

const navigationActions = new WeakMap<HTMLElement, NavigationActions>();
const dragCleanups = new WeakMap<HTMLElement, () => void>();

export function renderReadingNavigation(
	container: HTMLElement,
	state: NavigationState,
	actions: NavigationActions,
): void {
	navigationActions.set(container, actions);
	const existing = container.querySelector<HTMLElement>('.reading-markers-navigation');
	if (existing) {
		const update = (name: string, enabled: boolean, title?: string): void => {
			const button = existing.querySelector<HTMLButtonElement>(`[data-navigation-action="${name}"]`);
			if (!button) return;
			button.disabled = !enabled;
			if (title) {
				button.title = title;
				button.setAttribute('aria-label', title);
			}
		};
		update('previous', state.hasPrevious);
		update('next', state.hasNext);
		update('center', state.centerEnabled, state.centerTitle ?? strings().navigationCenter);
		update('resume', !!state.hasProgress);
		const continueButton = existing.querySelector<HTMLElement>('[data-navigation-action="continue"]');
		continueButton?.toggleClass('reading-markers-hidden', !state.detouring);
		applyPosition(container, getNavigationPosition(container));
		return;
	}
	initializeNavigationHost(container);
	const collapsed = container.dataset.collapsed === 'true';
	const side = getNavigationPosition(container).side;
	container.empty();
	const shell = container.createDiv({ cls: 'reading-markers-navigation-shell' });
	const toolbar = shell.createDiv({
		cls: 'reading-markers-navigation',
		attr: {
			role: 'toolbar',
			'aria-label': strings().navigationLabel,
		},
	});
	const toolbarHeader = toolbar.createDiv({ cls: 'reading-markers-navigation-header' });
	const grip = toolbarHeader.createEl('button', {
		cls: 'reading-markers-navigation-grip',
		attr: {
			type: 'button',
			title: strings().navigationDrag,
			'aria-label': strings().navigationDrag,
		},
	});
	setIcon(grip, 'grip-horizontal');
	grip.addEventListener('pointerdown', (event) => startDrag(container, event));

	const collapse = toolbarHeader.createEl('button', {
		cls: 'reading-markers-navigation-collapse',
		attr: {
			type: 'button',
			title: strings().navigationCollapse,
			'aria-label': strings().navigationCollapse,
		},
	});
	setIcon(collapse, side === 'left' ? 'chevron-left' : 'chevron-right');
	collapse.addEventListener('click', () => setCollapsed(container, true));

	const buttons = toolbar.createDiv({ cls: 'reading-markers-navigation-buttons' });

	const previous = createNavigationButton(
		buttons,
		'chevron-up',
		strings().navigationPrevious,
		state.hasPrevious,
		() => navigationActions.get(container)?.goPrevious(),
	);
	previous.dataset.navigationAction = 'previous';
	const center = createNavigationButton(
		buttons,
		'circle',
		state.centerTitle ?? strings().navigationCenter,
		state.centerEnabled,
		() => navigationActions.get(container)?.goCenter(),
	);
	center.dataset.navigationAction = 'center';
	const next = createNavigationButton(
		buttons,
		'chevron-down',
		strings().navigationNext,
		state.hasNext,
		() => navigationActions.get(container)?.goNext(),
	);
	next.dataset.navigationAction = 'next';
	const list = createNavigationButton(buttons, 'list', strings().openMarkerList, true,
		() => navigationActions.get(container)?.openMarkers?.());
	list.dataset.navigationAction = 'list';
	const resume = createNavigationButton(buttons, 'history', strings().resumeReading, !!state.hasProgress,
		() => navigationActions.get(container)?.resume?.());
	resume.dataset.navigationAction = 'resume';
	const continueButton = createNavigationButton(buttons, 'play', strings().continueReadingHere, true,
		() => navigationActions.get(container)?.continueHere?.());
	continueButton.dataset.navigationAction = 'continue';
	continueButton.toggleClass('reading-markers-hidden', !state.detouring);

	const expand = shell.createEl('button', {
		cls: 'reading-markers-navigation-expand-handle',
		attr: {
			type: 'button',
			title: strings().navigationExpand,
			'aria-label': strings().navigationExpand,
		},
	});
	setIcon(expand, side === 'left' ? 'chevron-right' : 'chevron-left');
	expand.addEventListener('click', () => setCollapsed(container, false));

	container.toggleClass('reading-markers-navigation-collapsed', collapsed);
	applyPosition(container, getNavigationPosition(container));
	ensureInteractionHandlers(container);
	scheduleAutoCollapse(container);
}

function createNavigationButton(
	container: HTMLElement,
	icon: string,
	title: string,
	enabled: boolean,
	onClick: () => void,
): HTMLButtonElement {
	const button = container.createEl('button', {
		cls: 'reading-markers-navigation-button',
		attr: {
			type: 'button',
			title,
			'aria-label': title,
		},
	});
	setIcon(button, icon);
	button.disabled = !enabled;
	button.addEventListener('click', onClick);
	return button;
}

export function destroyReadingNavigation(container: HTMLElement): void {
	clearAutoCollapse(container);
	dragCleanups.get(container)?.();
	navigationActions.delete(container);
}

export function removeStaleNavigation(container: HTMLElement): void {
	for (const host of Array.from(container.querySelectorAll<HTMLElement>('.reading-markers-navigation-host'))) {
		destroyReadingNavigation(host);
		host.remove();
	}
}

function initializeNavigationHost(container: HTMLElement): void {
	if (container.dataset.navigationInitialized === 'true') {
		return;
	}

	container.dataset.navigationInitialized = 'true';
	const stored = readStoredPosition();
	container.dataset.navigationPosition = JSON.stringify(stored);
	applyPosition(container, stored);
}

function getNavigationPosition(container: HTMLElement): NavigationPosition {
	try {
		const value = container.dataset.navigationPosition;
		if (value) {
			return normalizePosition(JSON.parse(value) as Partial<NavigationPosition>);
		}
	} catch {
		// Fall back to the default position when an old or malformed value is present.
	}

	return { side: 'right', topPercent: 0.5, xPercent: 0.5 };
}

function setNavigationPosition(container: HTMLElement, position: NavigationPosition): void {
	const normalized = normalizePosition(position);
	container.dataset.navigationPosition = JSON.stringify(normalized);
	applyPosition(container, normalized);
	try {
		window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(normalized));
	} catch {
		// Position changes remain available for this view when storage is unavailable.
	}
}

function readStoredPosition(): NavigationPosition {
	try {
		const stored = window.localStorage.getItem(POSITION_STORAGE_KEY);
		if (stored) {
			return normalizePosition(JSON.parse(stored) as Partial<NavigationPosition>);
		}
	} catch {
		// Use the default position when storage is unavailable or malformed.
	}

	return { side: 'right', topPercent: 0.5, xPercent: 0.5 };
}

function normalizePosition(value: Partial<NavigationPosition>): NavigationPosition {
	const side = value.side === 'left' || value.side === 'free' ? value.side : 'right';
	return {
		side,
		topPercent: clamp(value.topPercent ?? 0.5, 0.08, 0.92),
		xPercent: clamp(value.xPercent ?? 0.5, 0.08, 0.92),
	};
}

function applyPosition(container: HTMLElement, position: NavigationPosition): void {
	const changedSide = container.dataset.side !== position.side;
	container.dataset.side = position.side;
	const parent = container.offsetParent as HTMLElement | null;
	const toolbar = container.querySelector<HTMLElement>('.reading-markers-navigation');
	if (toolbar && parent?.clientHeight) {
		const maxHeight = `${Math.max(32, parent.clientHeight - 48)}px`;
		toolbar.setCssProps({ '--reading-markers-nav-max-height': maxHeight });
	}
	const inset = Math.ceil(container.offsetHeight / 2) + 12;
	const cssProps: Record<string, string> = {
		top: `clamp(${inset}px, ${position.topPercent * 100}%, calc(100% - ${inset}px))`,
		transform: 'translateY(-50%)',
	};
	const edge = container.dataset.collapsed === 'true' ? '0px' : '12px';
	if (changedSide) {
		const collapse = container.querySelector<HTMLElement>('.reading-markers-navigation-collapse');
		const expand = container.querySelector<HTMLElement>('.reading-markers-navigation-expand-handle');
		if (collapse) setIcon(collapse, position.side === 'left' ? 'chevron-left' : 'chevron-right');
		if (expand) setIcon(expand, position.side === 'left' ? 'chevron-right' : 'chevron-left');
	}

	if (position.side === 'left') {
		cssProps.left = edge;
		cssProps.right = 'auto';
		container.setCssProps(cssProps);
		return;
	}

	if (position.side === 'free') {
		cssProps.left = `clamp(12px, ${position.xPercent * 100}%, calc(100% - ${container.offsetWidth + 12}px))`;
		cssProps.right = 'auto';
		container.setCssProps(cssProps);
		return;
	}

	cssProps.left = 'auto';
	cssProps.right = edge;
	container.setCssProps(cssProps);
}

function setCollapsed(container: HTMLElement, collapsed: boolean): void {
	if ((container.dataset.collapsed === 'true') === collapsed) {
		return;
	}

	container.dataset.collapsed = String(collapsed);
	container.toggleClass('reading-markers-navigation-collapsed', collapsed);
	applyPosition(container, getNavigationPosition(container));
	if (collapsed) {
		clearAutoCollapse(container);
	} else {
		clearAutoCollapse(container);
		scheduleAutoCollapse(container);
	}
}

function ensureInteractionHandlers(container: HTMLElement): void {
	if (container.dataset.interactionsBound === 'true') {
		return;
	}

	container.dataset.interactionsBound = 'true';
	container.addEventListener('pointerenter', () => {
		clearAutoCollapse(container);
	});
	container.addEventListener('pointerleave', () => {
		scheduleAutoCollapse(container);
	});
	container.addEventListener('focusin', () => {
		clearAutoCollapse(container);
	});
	container.addEventListener('focusout', () => {
		scheduleAutoCollapse(container);
	});
}

function scheduleAutoCollapse(container: HTMLElement): void {
	clearAutoCollapse(container);
	const timeout = window.setTimeout(() => {
		const activeElement = document.activeElement;
		if (!container.matches(':hover') && (!activeElement || !container.contains(activeElement))) {
			setCollapsed(container, true);
		}
	}, AUTO_COLLAPSE_DELAY_MS);
	container.dataset.collapseTimer = String(timeout);
}

function clearAutoCollapse(container: HTMLElement): void {
	const timer = Number(container.dataset.collapseTimer);
	if (timer) {
		window.clearTimeout(timer);
		delete container.dataset.collapseTimer;
	}
}

function startDrag(container: HTMLElement, event: PointerEvent): void {
	if (event.button !== 0) {
		return;
	}

	const parent = container.offsetParent as HTMLElement | null;
	if (!parent) {
		return;
	}

	event.preventDefault();
	dragCleanups.get(container)?.();
	setCollapsed(container, false);
	container.addClass('reading-markers-navigation-dragging');
	clearAutoCollapse(container);

	const parentRect = parent.getBoundingClientRect();
	const startX = event.clientX;
	const startY = event.clientY;
	const startRect = container.getBoundingClientRect();
	const startCenterX = startRect.left + startRect.width / 2;
	const startCenterY = startRect.top + startRect.height / 2;

	const update = (moveEvent: PointerEvent): void => {
		const centerX = startCenterX + moveEvent.clientX - startX;
		const centerY = startCenterY + moveEvent.clientY - startY;
		const side =
			centerX - parentRect.left <= EDGE_SNAP_DISTANCE
				? 'left'
				: parentRect.right - centerX <= EDGE_SNAP_DISTANCE
					? 'right'
					: 'free';
		setNavigationPosition(container, {
			side,
			topPercent: (centerY - parentRect.top) / Math.max(1, parentRect.height),
			xPercent: (centerX - parentRect.left) / Math.max(1, parentRect.width),
		});
	};
	const cleanup = (): void => {
		window.removeEventListener('pointermove', update);
		window.removeEventListener('pointerup', finish);
		window.removeEventListener('pointercancel', cancel);
		container.removeClass('reading-markers-navigation-dragging');
		dragCleanups.delete(container);
	};
	const cancel = (): void => { cleanup(); scheduleAutoCollapse(container); };
	const finish = (upEvent: PointerEvent): void => {
		update(upEvent);
		cleanup();
		const position = getNavigationPosition(container);
		if (position.side === 'left' || position.side === 'right') {
			setCollapsed(container, true);
		} else {
			scheduleAutoCollapse(container);
		}
	};

	dragCleanups.set(container, cleanup);
	window.addEventListener('pointermove', update);
	window.addEventListener('pointerup', finish, { once: true });
	window.addEventListener('pointercancel', cancel, { once: true });
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
