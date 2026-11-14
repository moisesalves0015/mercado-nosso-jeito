import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DATA_URL_LENGTH,
  isAcceptableDataUrlSize,
  uploadOrCompressImage,
} from '../src/services/imageUploadService';

test('imageUploadService: limites de tamanho para documentos Firestore', () => {
  // O limite máximo do Firestore por documento é de 1.048.576 bytes.
  // MAX_DATA_URL_LENGTH deve ser estritamente menor que 1 MiB para garantir
  // que o documento inteiro (com outros campos, arrays e metadados) salve sem erro.
  assert.ok(MAX_DATA_URL_LENGTH < 1_048_576, 'MAX_DATA_URL_LENGTH deve ser menor que 1MiB');
  assert.equal(MAX_DATA_URL_LENGTH, 700_000, 'MAX_DATA_URL_LENGTH deve ser 700.000 caracteres (~500KB)');

  // Validação do helper de verificação
  const safeDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(500_000);
  assert.equal(isAcceptableDataUrlSize(safeDataUrl), true, '500KB data URL deve ser aceitável');

  const oversizedDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(750_000);
  assert.equal(isAcceptableDataUrlSize(oversizedDataUrl), false, '750KB data URL excede limite seguro');

  // String normal HTTP não é data URL, deve passar
  assert.equal(isAcceptableDataUrlSize('https://images.unsplash.com/photo-123'), true);
});

test('imageUploadService: rejeição amigável sem canvas no Node', async () => {
  // No ambiente Node sem browser DOM, deve tratar o erro de forma segura sem crash não tratado
  const dummyFile = new File(['mock content'], 'test.png', { type: 'image/png' });
  await assert.rejects(
    async () => {
      await uploadOrCompressImage(dummyFile, { folder: 'products' });
    },
    (err: Error) => {
      // Deve falhar com mensagem clara em ambiente não-DOM
      return err instanceof Error;
    }
  );
});

