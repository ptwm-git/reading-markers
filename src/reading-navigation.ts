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
	hasNext: boolean;
}

export interface NavigationActions {
	goPrevious(): void;
	goCenter(): void;
	goNext(): void;
}

export function renderReadingNavigation(
	container: HTMLElement,
	state: NavigationState,
	actions: NavigationActions,
): void {
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

	createNavigationButton(
		buttons,
		'chevron-up',
		strings().navigationPrevious,
		state.hasPrevious,
		() => actions.goPrevious(),
	);
	createNavigationButton(
		buttons,
		'circle',
		strings().navigationCenter,
		state.centerEnabled,
		() => actions.goCenter(),
	);
	createNavigationButton(
		buttons,
		'chevron-down',
		strings().navigationNext,
		state.hasNext,
		() => actions.goNext(),
	);

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
	ensureInteractionHandlers(container);
	scheduleAutoCollapse(container);
}

function createNavigationButton(
	container: HTMLElement,
	icon: string,
	title: string,
	enabled: boolean,
	onClick: () => void,
): void {
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
	container.dataset.side = position.side;
	const cssProps: Record<string, string> = {
		top: `${position.topPercent * 100}%`,
		transform: 'translateY(-50%)',
	};

	if (position.side === 'left') {
		cssProps.left = '12px';
		cssProps.right = 'auto';
		container.setCssProps(cssProps);
		return;
	}

	if (position.side === 'free') {
		cssProps.left = `${position.xPercent * 100}%`;
		cssProps.right = 'auto';
		container.setCssProps(cssProps);
		return;
	}

	cssProps.left = 'auto';
	cssProps.right = '12px';
	container.setCssProps(cssProps);
}

function setCollapsed(container: HTMLElement, collapsed: boolean): void {
	if ((container.dataset.collapsed === 'true') === collapsed) {
		return;
	}

	container.dataset.collapsed = String(collapsed);
	container.toggleClass('reading-markers-navigation-collapsed', collapsed);
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
	const finish = (upEvent: PointerEvent): void => {
		update(upEvent);
		container.removeClass('reading-markers-navigation-dragging');
		const position = getNavigationPosition(container);
		if (position.side === 'left' || position.side === 'right') {
			setCollapsed(container, true);
		} else {
			scheduleAutoCollapse(container);
		}
		window.removeEventListener('pointermove', update);
		window.removeEventListener('pointerup', finish);
	};

	window.addEventListener('pointermove', update);
	window.addEventListener('pointerup', finish, { once: true });
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
