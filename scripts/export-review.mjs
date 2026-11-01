import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = process.argv[2] && path.resolve(process.argv[2]);
if (!appRoot) throw new Error('Usage: node scripts/export-review.mjs /path/to/dhikr-app');
const [prayerSource, arabicSource, packageSource] = await Promise.all([
  fs.readFile(path.join(appRoot, 'src/data/prayers.json'), 'utf8'),
  fs.readFile(path.join(appRoot, 'src/data/arabic_verified.json'), 'utf8'),
  fs.readFile(path.join(appRoot, 'package.json'), 'utf8'),
]);
const input = JSON.parse(prayerSource);
const verifiedArabic = JSON.parse(arabicSource);
const prayers = Object.values(input.sections).flatMap(section => section.prayers).map(prayer => ({
  ...prayer,
  arabic: verifiedArabic[prayer.id] || prayer.arabic || '',
  compositionIds: prayer.id === 'sleep_1'
    ? ['sleep_1', 'morning_4', 'morning_5', 'morning_6']
    : [prayer.id],
}));
if (prayers.length !== input.meta.total_prayers || new Set(prayers.map(p => p.id)).size !== prayers.length) {
  throw new Error('Prayer count or identity mismatch');
}
for (const prayer of prayers) {
  if (!prayer.compositionIds.every(id => prayers.some(p => p.id === id))) throw new Error('Missing composition part');
}
const content = {
  meta: {
    ...input.meta,
    title_ar: 'كتاب الذكر والدعاء في ضوء الكتاب والسنة',
    appVersion: JSON.parse(packageSource).version,
    exportedAt: new Date().toISOString(),
    contentRevision: createHash('sha256').update(prayerSource).update('\n').update(arabicSource).digest('hex'),
  },
  sections: Object.values(input.sections).map(section => ({id: section.id, label: section.label_sq, count: section.prayers.length})),
  prayers,
};
await fs.mkdir(path.join(siteRoot, 'review/fonts'), {recursive: true});
await fs.writeFile(path.join(siteRoot, 'review/content.json'), JSON.stringify(content, null, 2) + '\n');
const fontRoot = path.join(appRoot, 'node_modules/@expo-google-fonts/scheherazade-new');
await fs.copyFile(path.join(fontRoot, '400Regular/ScheherazadeNew_400Regular.ttf'), path.join(siteRoot, 'review/fonts/ScheherazadeNew-Regular.ttf'));
await fs.copyFile(path.join(fontRoot, 'LICENSE_FONT'), path.join(siteRoot, 'review/fonts/OFL.txt'));
console.log(`Exported ${prayers.length} prayers with ${prayers.reduce((n, p) => n + p.compositionIds.length, 0)} displayed parts.`);
