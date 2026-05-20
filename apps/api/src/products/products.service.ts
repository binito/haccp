import {
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

const PRODUCTS_CACHE_KEY = 'products:all';
const PRODUCTS_TTL = 300000; // 5 minutes

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async create(dto: CreateProductDto) {
    if (dto.sku) {
      const existe = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (existe) throw new ConflictException('SKU já existe');
    }
    const result = await this.prisma.product.create({ data: dto });
    await this.cache.del(PRODUCTS_CACHE_KEY);
    return result;
  }

  async findAll(category?: string) {
    if (!category) {
      const cached = await this.cache.get(PRODUCTS_CACHE_KEY);
      if (cached) return cached;
    }
    const data = await this.prisma.product.findMany({
      where: {
        active: true,
        ...(category ? { category } : {}),
      },
      orderBy: { name: 'asc' },
    });
    if (!category) await this.cache.set(PRODUCTS_CACHE_KEY, data, PRODUCTS_TTL);
    return data;
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async update(id: string, data: Partial<CreateProductDto>) {
    await this.findOne(id);
    const result = await this.prisma.product.update({ where: { id }, data });
    await this.cache.del(PRODUCTS_CACHE_KEY);
    return result;
  }

  async deactivate(id: string) {
    await this.findOne(id);
    const result = await this.prisma.product.update({
      where: { id },
      data: { active: false },
      select: { id: true, active: true },
    });
    await this.cache.del(PRODUCTS_CACHE_KEY);
    return result;
  }

  async importFromCsv(buffer: Buffer): Promise<{ created: number; updated: number; skipped: number }> {
    const text = buffer.toString('utf-8');

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    // Ignorar cabeçalho
    const dataLines = lines.slice(1);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const line of dataLines) {
      // Parsear CSV com delimitador ";" e aspas
      const cols = line.split(';').map((c) => c.replace(/^"|"$/g, '').trim());
      const sku  = cols[1];
      const nome = cols[2];
      const familia = cols[3];
      const marca = cols[5];
      const precoVenda = cols[9];
      const tipoArtigo = cols[14]; // N=produto, S=serviço

      if (!sku || !nome || sku === '.' || tipoArtigo === 'S') {
        skipped++;
        continue;
      }

      const price = precoVenda ? parseFloat(precoVenda.replace(',', '.')) : null;
      const category = familia || null;
      const description = marca || null;

      const existing = await this.prisma.product.findUnique({ where: { sku } });
      if (existing) {
        await this.prisma.product.update({
          where: { sku },
          data: { name: nome, category, description, price, active: true },
        });
        updated++;
      } else {
        await this.prisma.product.create({
          data: { sku, name: nome, category, description, price, active: true },
        });
        created++;
      }
    }

    await this.cache.del(PRODUCTS_CACHE_KEY);
    return { created, updated, skipped };
  }
}
