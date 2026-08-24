import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const errors = [];
const checks = [];

function readJson(path) {
	try {
		return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
	} catch (error) {
		errors.push(`${path} is missing or invalid: ${String(error)}`);
		return {};
	}
}

function requireCheck(condition, message) {
	if (condition) {
		checks.push(message);
	} else {
		errors.push(message);
	}
}

function fileExists(path, minimumBytes = 1) {
	try {
		return statSync(resolve(root, path)).size >= minimumBytes;
	} catch {
		return false;
	}
}

const manifest = readJson('manifest.json');
const packageJson = readJson('package.json');
const versions = readJson('versions.json');
const versionPattern = /^\d+\.\d+\.\d+$/;
const requiredManifestFields = [
	'id',
	'name',
	'version',
	'minAppVersion',
	'description',
	'author',
	'isDesktopOnly',
];

for (const field of requiredManifestFields) {
	requireCheck(Object.hasOwn(manifest, field), `manifest includes ${field}`);
}

requireCheck(
	versionPattern.test(manifest.version),
	'manifest version uses x.y.z format',
);
requireCheck(
	packageJson.version === manifest.version,
	'package and manifest versions match',
);
requireCheck(
	versions[manifest.version] === manifest.minAppVersion,
	'versions mapping matches the current minimum app version',
);
requireCheck(
	Object.keys(versions).every((version) => versionPattern.test(version)),
	'all versions mapping keys use x.y.z format',
);
requireCheck(
	/^[a-z0-9-]+$/.test(manifest.id) &&
		!manifest.id.includes('obsidian') &&
		!manifest.id.endsWith('plugin'),
	'plugin ID follows community naming rules',
);
requireCheck(
	!manifest.name.toLowerCase().includes('obsidian') &&
		!manifest.name.toLowerCase().endsWith('plugin'),
	'plugin name follows community naming rules',
);
requireCheck(
	typeof manifest.description === 'string' &&
		manifest.description.length <= 250 &&
		/[.?!)]$/.test(manifest.description) &&
		!manifest.description.toLowerCase().includes('this plugin') &&
		!manifest.description.toLowerCase().includes('obsidian'),
	'plugin description follows community requirements',
);
requireCheck(
	typeof manifest.author === 'string' &&
		manifest.author.trim().length > 0 &&
		!/(local developer|your name|sample)/i.test(manifest.author),
	'author placeholder has been removed',
);
requireCheck(
	manifest.authorUrl === 'https://github.com/ptwm-git',
	'author URL matches the confirmed GitHub account',
);
requireCheck(
	packageJson.repository?.url ===
		'git+https://github.com/ptwm-git/reading-markers.git',
	'package repository matches the confirmed public repository',
);
requireCheck(
	typeof manifest.isDesktopOnly === 'boolean',
	'isDesktopOnly is a boolean',
);

for (const path of [
	'README.md',
	'LICENSE',
	'CHANGELOG.md',
	'package-lock.json',
	'main.js',
	'manifest.json',
	'styles.css',
	`release-notes/${manifest.version}.md`,
]) {
	requireCheck(fileExists(path), `${path} exists and is not empty`);
}

if (fileExists('main.js')) {
	const bundle = readFileSync(resolve(root, 'main.js'), 'utf8');
	requireCheck(
		!bundle.includes('sourceMappingURL='),
		'production bundle does not contain a source map',
	);
}

if (errors.length > 0) {
	console.error('Release validation failed:');
	errors.forEach((error) => console.error(`- ${error}`));
	process.exit(1);
}

console.log(`Release validation passed (${checks.length} checks).`);
