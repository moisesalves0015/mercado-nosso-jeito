import { pathToFileURL } from 'node:url';
import { defaultProducts, Product } from '../src/data/defaultProducts';

interface ValidationError {
  id: string;
  field: string;
  message: string;
  value: unknown;
}

export function validateProducts(products: Product[]): {
  valid: boolean;
  errors: ValidationError[];
  total: number;
  validCount: number;
} {
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();

  products.forEach((p, index) => {
    const id = p.id || `index_${index}`;

    if (!p.id || typeof p.id !== 'string' || !p.id.trim()) {
      errors.push({ id, field: 'id', message: 'ID ausente ou inválido', value: p.id });
    } else if (seenIds.has(p.id)) {
      errors.push({ id, field: 'id', message: 'ID duplicado', value: p.id });
    } else {
      seenIds.add(p.id);
    }

    if (!p.title || typeof p.title !== 'string' || !p.title.trim()) {
      errors.push({ id, field: 'title', message: 'Título ausente ou inválido', value: p.title });
    }

    if (typeof p.price !== 'number' || isNaN(p.price) || p.price <= 0) {
      errors.push({ id, field: 'price', message: 'Preço deve ser um número positivo (> 0)', value: p.price });
    }

    if (typeof p.stock !== 'number' || !Number.isInteger(p.stock) || p.stock < 0) {
      errors.push({ id, field: 'stock', message: 'Estoque deve ser um número inteiro >= 0', value: p.stock });
    }

    if (typeof p.active !== 'boolean') {
      errors.push({ id, field: 'active', message: 'Campo active deve ser boolean (true/false)', value: p.active });
    }

    if (!p.image || typeof p.image !== 'string' || !p.image.trim()) {
      errors.push({ id, field: 'image', message: 'Imagem ausente ou vazia', value: p.image });
    }

    if (p.promoActive) {
      if (typeof p.promoPrice !== 'number' || isNaN(p.promoPrice) || p.promoPrice <= 0) {
        errors.push({ id, field: 'promoPrice', message: 'Promoção ativa exige promoPrice positivo', value: p.promoPrice });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    total: products.length,
    validCount: products.length - errors.length,
  };
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isDirectRun) {
  const report = validateProducts(defaultProducts);
  console.log(`--- RELATÓRIO DE VALIDAÇÃO DE PRODUTOS ---`);
  console.log(`Total de produtos avaliados: ${report.total}`);
  console.log(`Erros encontrados: ${report.errors.length}`);
  if (!report.valid) {
    console.table(report.errors);
    process.exitCode = 1;
  } else {
    console.log(`✅ Todos os produtos passaram na validação com sucesso!`);
  }
}
