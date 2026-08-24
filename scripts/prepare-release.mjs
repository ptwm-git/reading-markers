import {
	copyFileSync,
	mkdirSync,
	readFileSync,
	rmSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
const destination = resolve(root, 'release', manifest.version);
const assets = ['main.js', 'manifest.json', 'styles.css'];

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });

for (const asset of assets) {
	const source = resolve(root, asset);
	copyFileSync(source, resolve(destination, asset));
	const digest = createHash('sha256').update(readFileSync(source)).digest('hex');
	console.log(`${asset}  ${digest}`);
}

console.log(`Prepared release assets in release/${manifest.version}.`);
