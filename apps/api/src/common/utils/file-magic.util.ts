import { BadRequestException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { open } from 'fs/promises';

// Magic byte signatures for allowed image formats
const SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WebP: RIFF????WEBP
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF prefix
];

async function detectMimeType(filePath: string): Promise<string | null> {
  const handle = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    await handle.read(buf, 0, 12, 0);

    // Check JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    // Check PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
    // Check WebP (RIFF....WEBP)
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';

    return null;
  } finally {
    await handle.close();
  }
}

// Valida os magic bytes de cada ficheiro já gravado em disco.
// Se o tipo real não corresponder ao declarado, apaga o ficheiro e lança excepção.
export async function validateFileMagicBytes(files: Express.Multer.File[]): Promise<void> {
  for (const file of files) {
    const detected = await detectMimeType(file.path).catch(() => null);

    if (!detected) {
      await unlink(file.path).catch(() => {});
      throw new BadRequestException(
        `Ficheiro inválido: o conteúdo de "${file.originalname}" não é uma imagem JPEG, PNG ou WebP válida.`,
      );
    }
  }
}
