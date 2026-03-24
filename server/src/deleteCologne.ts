import { initDatabase, deleteCologne, getAllColognes } from './db';

const slug = process.argv[2];

if (!slug) {
  console.error('Usage: npm run delete-cologne <slug>');
  console.error('');
  console.error('Run `npm run list-colognes` to see available slugs.');
  process.exit(1);
}

initDatabase();
const deleted = deleteCologne(slug);

if (deleted) {
  console.log(`Deleted: ${slug}`);
} else {
  console.error(`Not found: "${slug}"`);
  console.error('');
  const all = getAllColognes();
  if (all.length > 0) {
    console.error('Available slugs:');
    for (const c of all) {
      console.error(`  ${c.slug}  (${c.brand} ${c.name})`);
    }
  }
  process.exit(1);
}
