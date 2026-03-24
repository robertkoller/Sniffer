import { initDatabase, getAllColognes } from './db';

initDatabase();
const colognes = getAllColognes();

if (colognes.length === 0) {
  console.log('Database is empty.');
} else {
  console.log(`${colognes.length} cologne(s) in database:\n`);
  for (const c of colognes) {
    console.log(`  ${c.brand} ${c.name}  [slug: ${c.slug}]`);
  }
}
