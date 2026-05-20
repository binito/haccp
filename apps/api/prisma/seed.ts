import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function parsePortugueseFloat(val: string): number | null {
  const cleaned = val.replace(',', '.').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseCsvProducts(): Array<{
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  price: number | null;
  active: boolean;
}> {
  const csvPath = path.resolve(__dirname, '../../../docs/artigos.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  const products = [];

  // Skip header (line 0) and text-free entry (line 1 with sku ".")
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSV uses ";" as delimiter, fields wrapped in double quotes
    const fields = line.split('";"').map(f => f.replace(/^"|"$/g, ''));

    // cols: 0=empty, 1=sku, 2=name, 3=família, 4=sub-família, 5=marca,
    //       6=stock, 7=stockTec, 8=custMedio, 9=preçoVenda, 10=pvpIva,
    //       11=margemLucro, 12=valorLucro, 13=estado, 14=tipoArtigo
    if (fields.length < 15) continue;

    const sku = fields[1].trim();
    const name = fields[2].trim();
    const tipoArtigo = fields[14].trim();

    // Skip text/service entries and rows with invalid SKU
    if (!sku || sku === '.' || tipoArtigo !== 'N') continue;

    const category = fields[3].trim() || null;
    const brand = fields[5].trim() || null;
    const price = parsePortugueseFloat(fields[9]);
    const active = fields[13].trim() === 'T';

    products.push({ sku, name, category, brand, price, active });
  }

  return products;
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD não está definida. Adiciona ao .env antes de correr o seed.');
  }
  const hash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@haccp.local' },
    update: {},
    create: {
      name: 'Admin HACCP',
      email: 'admin@haccp.local',
      password: hash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('Admin criado:', admin.email);

  // Substituir todos os produtos pelos do CSV
  await prisma.product.deleteMany();
  console.log('Produtos anteriores removidos.');

  const products = parseCsvProducts();

  for (const p of products) {
    await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        category: p.category ?? undefined,
        description: p.brand ?? undefined,
        price: p.price ?? undefined,
        active: p.active,
      },
    });
  }

  console.log(`${products.length} produtos importados do CSV.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
