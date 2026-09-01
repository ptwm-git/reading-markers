import { MarkerColor } from './types';

export interface ReadingMarkerStrings {
	addReadingMarker: string;
	changeMarkerColor: string;
	chooseMarkerColor: string;
	colorUpdated: string;
	markerAdded: string;
	markerRemoved: string;
	deleteMarker: string;
	noMarkdownFile: string;
	documentChanged: string;
	documentSwitched: string;
	invalidTarget: string;
	frontmatterUnsupported: string;
	codeBlockUnsupported: string;
	emptyLineUnsupported: string;
	blockquoteUnsupported: string;
	tableUnsupported: string;
	htmlUnsupported: string;
	alreadyMarked: string;
	existingBlockId: string;
	invalidMarker: string;
	markerMissing: string;
	operationFailed: string;
	settingsSaveFailed: string;
	settingsLoadFailed: string;
	unnamedPosition: string;
	showSuccessNotices: string;
	showSuccessNoticesDescription: string;
	enableDebugLogging: string;
	enableDebugLoggingDescription: string;
	markerBarLabel: string;
	addPdfReadingMarker: string;
	noPdfFile: string;
	pdfPageUnavailable: string;
	pdfPageAlreadyMarked: string;
	pdfMarkerAdded: string;
	pdfMarkerMissing: string;
	pdfDataSaveFailed: string;
	pdfScannedNotice: string;
	pdfPageLabel(page: number): string;
	navigationLabel: string;
	navigationPrevious: string;
	navigationCenter: string;
	navigationSaveReturnTitle: string;
	navigationSaveReturnDescription: string;
	navigationSaveReturn: string;
	navigationSkipReturn: string;
	navigationCancel: string;
	navigationReturnPosition: string;
	navigationNext: string;
	navigationCenterRequiresMarker: string;
	navigationDrag: string;
	navigationCollapse: string;
	navigationExpand: string;
	colors: Record<MarkerColor, string>;
	markerGroupLabel(color: string): string;
	markerTitle(color: string, excerpt: string): string;
	jumpToMarker(color: string, excerpt: string): string;
	changeToColor(color: string): string;
}

const ENGLISH: ReadingMarkerStrings = {
	addReadingMarker: 'Add reading marker',
	changeMarkerColor: 'Change reading marker color',
	chooseMarkerColor: 'Choose reading marker color',
	colorUpdated: 'Reading marker color updated.',
	markerAdded: 'Reading marker added.',
	markerRemoved: 'Reading marker removed.',
	deleteMarker: 'Delete reading marker',
	noMarkdownFile: 'Open a Markdown note first.',
	documentChanged: 'The note changed. Try the action again.',
	documentSwitched: 'The active note changed. Add the marker again at the target position.',
	invalidTarget: 'The target reading position could not be determined.',
	frontmatterUnsupported: 'Reading markers cannot be added to note properties.',
	codeBlockUnsupported: 'Reading markers are not supported in code blocks.',
	emptyLineUnsupported: 'Add a reading marker to a line that contains note content.',
	blockquoteUnsupported: 'Reading markers are not supported in blockquotes or Callouts.',
	tableUnsupported: 'Reading markers are not supported in tables.',
	htmlUnsupported: 'Reading markers are not supported in HTML content.',
	alreadyMarked: 'This content block already has a reading marker.',
	existingBlockId: 'This content block already has another block ID.',
	invalidMarker: 'No valid reading marker was found.',
	markerMissing: 'This reading marker no longer exists.',
	operationFailed: 'The reading marker action failed. Try again and check the developer console.',
	settingsSaveFailed: 'Reading Markers settings could not be saved. The previous settings were restored.',
	settingsLoadFailed: 'Reading Markers settings could not be loaded. Default settings are in use.',
	unnamedPosition: 'Unnamed position',
	showSuccessNotices: 'Show success notices',
	showSuccessNoticesDescription: 'Show a short notice after a marker is added, changed, or removed. Error notices always remain visible.',
	enableDebugLogging: 'Enable debug logging',
	enableDebugLoggingDescription: 'Record successful actions at the verbose level in the developer console. Enable this only when troubleshooting.',
	markerBarLabel: 'Reading markers in the current document',
	addPdfReadingMarker: 'Add PDF reading marker',
	noPdfFile: 'Open a PDF document first.',
	pdfPageUnavailable: 'The current PDF page could not be determined.',
	pdfPageAlreadyMarked: 'This PDF page already has a reading marker.',
	pdfMarkerAdded: 'PDF reading marker added.',
	pdfMarkerMissing: 'This PDF reading marker no longer exists.',
	pdfDataSaveFailed: 'PDF reading markers could not be saved.',
	pdfScannedNotice: 'No PDF text layer detected. Page markers are supported; text-level locations are unavailable.',
	pdfPageLabel: (page) => `Page ${page}`,
	navigationLabel: 'Reading marker navigation',
	navigationPrevious: 'Jump to the nearest reading marker above',
	navigationCenter: 'Return to the current reading marker',
	navigationSaveReturnTitle: 'Save the current reading position?',
	navigationSaveReturnDescription: 'Saving it will replace the previous temporary return position.',
	navigationSaveReturn: 'Save and jump',
	navigationSkipReturn: 'Jump without saving',
	navigationCancel: 'Cancel',
	navigationReturnPosition: 'Return to the previous reading position',
	navigationNext: 'Jump to the nearest reading marker below',
	navigationCenterRequiresMarker: 'Add a reading marker at the current position before using the center button.',
	navigationDrag: 'Drag to move the reading marker navigation',
	navigationCollapse: 'Collapse reading marker navigation',
	navigationExpand: 'Expand reading marker navigation',
	colors: {
		red: 'Red',
		orange: 'Orange',
		yellow: 'Yellow',
		green: 'Green',
		blue: 'Blue',
		purple: 'Purple',
	},
	markerGroupLabel: (color) => `${color} reading markers`,
	markerTitle: (color, excerpt) => `${color}: ${excerpt}`,
	jumpToMarker: (color, excerpt) => `Jump to ${color} reading marker: ${excerpt}`,
	changeToColor: (color) => `Change to ${color}`,
};

const CHINESE: ReadingMarkerStrings = {
	addReadingMarker: '添加阅读标记',
	changeMarkerColor: '更改阅读标记颜色',
	chooseMarkerColor: '选择阅读标记颜色',
	colorUpdated: '阅读标记颜色已更新。',
	markerAdded: '阅读标记已添加。',
	markerRemoved: '阅读标记已删除。',
	deleteMarker: '删除阅读标记',
	noMarkdownFile: '请先打开 Markdown 文档。',
	documentChanged: '正文已发生变化，请重新执行操作。',
	documentSwitched: '文档已经切换，请在目标位置重新添加。',
	invalidTarget: '无法确定要标记的正文位置。',
	frontmatterUnsupported: '不能在文档属性区添加阅读标记。',
	codeBlockUnsupported: '暂不支持在代码块中添加阅读标记。',
	emptyLineUnsupported: '请在包含正文的行上添加阅读标记。',
	blockquoteUnsupported: '暂不支持在引用或 Callout 中添加阅读标记。',
	tableUnsupported: '暂不支持在表格中添加阅读标记。',
	htmlUnsupported: '暂不支持在 HTML 内容中添加阅读标记。',
	alreadyMarked: '这个正文块已经有阅读标记。',
	existingBlockId: '这个正文块已经有其他块标识符，暂不自动修改。',
	invalidMarker: '找不到有效的阅读标记。',
	markerMissing: '这个阅读标记已经不存在。',
	operationFailed: '阅读标记操作失败，请重试并查看开发者控制台。',
	settingsSaveFailed: '阅读标记设置保存失败，已恢复之前的设置。',
	settingsLoadFailed: '阅读标记设置加载失败，已使用默认设置。',
	unnamedPosition: '未命名位置',
	showSuccessNotices: '显示操作成功提示',
	showSuccessNoticesDescription: '添加、改色或删除成功后显示短暂通知。错误提示始终显示。',
	enableDebugLogging: '启用调试日志',
	enableDebugLoggingDescription: '在开发者控制台的 verbose 级别记录成功动作。排查问题时再开启。',
	markerBarLabel: '当前文档的阅读标记',
	addPdfReadingMarker: '添加 PDF 阅读标记',
	noPdfFile: '请先打开 PDF 文档。',
	pdfPageUnavailable: '无法确定当前 PDF 页码。',
	pdfPageAlreadyMarked: '这一 PDF 页面已经有阅读标记。',
	pdfMarkerAdded: 'PDF 阅读标记已添加。',
	pdfMarkerMissing: '这个 PDF 阅读标记已经不存在。',
	pdfDataSaveFailed: 'PDF 阅读标记保存失败。',
	pdfScannedNotice: '未检测到 PDF 文本层，可以按页添加标记，但暂不支持文本级定位。',
	pdfPageLabel: (page) => `第 ${page} 页`,
	navigationLabel: '阅读标记导航',
	navigationPrevious: '跳转到上方最近的阅读标记',
	navigationCenter: '返回当前阅读标记位置',
	navigationSaveReturnTitle: '是否标记当前阅读位置以便回退？',
	navigationSaveReturnDescription: '确认后会覆盖上一次临时回退位置。',
	navigationSaveReturn: '标记并跳转',
	navigationSkipReturn: '不标记，直接跳转',
	navigationCancel: '取消',
	navigationReturnPosition: '返回刚才的阅读位置',
	navigationNext: '跳转到下方最近的阅读标记',
	navigationCenterRequiresMarker: '请先在当前阅读位置添加阅读标记，再使用中间按钮。',
	navigationDrag: '拖动以移动阅读标记导航框',
	navigationCollapse: '收起阅读标记导航框',
	navigationExpand: '展开阅读标记导航框',
	colors: {
		red: '红色',
		orange: '橙色',
		yellow: '黄色',
		green: '绿色',
		blue: '蓝色',
		purple: '紫色',
	},
	markerGroupLabel: (color) => `${color}阅读标记`,
	markerTitle: (color, excerpt) => `${color}：${excerpt}`,
	jumpToMarker: (color, excerpt) => `跳转到${color}阅读标记：${excerpt}`,
	changeToColor: (color) => `改为${color}`,
};

let activeStrings = ENGLISH;

export function setLocale(locale: string): void {
	activeStrings = locale.toLowerCase().startsWith('zh') ? CHINESE : ENGLISH;
}

export function strings(): ReadingMarkerStrings {
	return activeStrings;
}
