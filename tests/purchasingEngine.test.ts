import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeProductReplenishment,
  applyCustodyMovementToOffer,
  applyLotAndPackConstraints,
  computeFinancialScenarios,
  computeFinancialSeparationReport,
  computePartnerFinancialScenarios,
  computePurchaseListSummary,
  diagnoseCatalogOrigins,
  evaluatePostApprovalChange,
  evaluatePostApprovalOfferChange,
  evaluatePurchaseReceiptStatus,
  findPotentialDuplicateProducts,
  isPartnerOfferAvailabilityExpired,
  resolveOrderFulfillmentPlan,
  resolvePurchasingPermissions,
  type ProductOfferRecord,
  type PurchaseListRecord,
} from '../src/utils/purchasingEngine.ts';

const NOW_MS = Date.parse('2026-04-15T12:00:00Z');

describe('Assistente de Compras — Motor de Reposição & Estoque em Trânsito', () => {
  it('applies minimum lot and pack multiple constraints accurately', () => {
    assert.equal(applyLotAndPackConstraints(0, 12, 6), 0);
    assert.equal(applyLotAndPackConstraints(5, 12, 6), 12);
    assert.equal(applyLotAndPackConstraints(13, 12, 6), 18);
    assert.equal(applyLotAndPackConstraints(7, 1, 10), 10);
  });

  it('calculates replenishment from real sales, lead time, safety stock and separates in-transit from physical stock', () => {
    const orders = [
      {
        status: 'delivered',
        paymentStatus: 'approved',
        createdAt: '2026-04-10T10:00:00Z',
        items: [{ productId: 'prod_heineken', quantity: 30, price: 7.5 }],
      },
      {
        status: 'delivered',
        paymentStatus: 'approved',
        createdAt: '2026-04-01T10:00:00Z',
        items: [{ productId: 'prod_heineken', quantity: 30, price: 7.5 }],
      },
      // Cancelled order should never be counted as sale
      {
        status: 'cancelled',
        paymentStatus: 'rejected',
        createdAt: '2026-04-12T10:00:00Z',
        items: [{ productId: 'prod_heineken', quantity: 50, price: 7.5 }],
      },
    ];

    // Approved purchase list with 6 units in transit
    const purchaseLists: Array<Partial<PurchaseListRecord>> = [
      {
        status: 'em_compra',
        items: [
          {
            productId: 'prod_heineken',
            productTitle: 'Cerveja Heineken 330ml',
            unit: 'UN',
            supplierId: 'sup_1',
            supplierName: 'Distribuidora Bebidas Sul',
            requestedQty: 12,
            purchasedQty: 12,
            receivedQty: 6, // 6 already received, 6 still in transit!
            quotedUnitCost: 4.5,
            currentSalePrice: 7.5,
            estimatedItemTotal: 54,
            reason: 'reposicao',
            notes: '',
          },
        ],
      },
    ];

    const analysis = analyzeProductReplenishment({
      product: {
        id: 'prod_heineken',
        title: 'Cerveja Heineken 330ml',
        price: 7.5,
        costPrice: 4.5,
        stock: 10,
        minStock: 12,
        category: 'Bebidas',
        unit: 'UN',
      },
      meta: {
        productId: 'prod_heineken',
        leadTimeDays: 4,
        safetyStockDays: 5,
        minLot: 12,
        packMultiple: 6,
      },
      orders,
      purchaseLists,
      periodDays: 30,
      nowMs: NOW_MS,
    });

    assert.equal(analysis.historyState, 'com_vendas');
    assert.equal(analysis.unitsSoldInPeriod, 60);
    assert.equal(analysis.dailyAvgSales, 2); // 60 / 30 days = 2/day
    assert.equal(analysis.physicalStock, 10);
    assert.equal(analysis.inTransitQty, 6); // Kept strictly separate from physicalStock
    assert.equal(analysis.demandDuringLeadTime, 8); // 2 * 4d
    assert.equal(analysis.safetyStockUnits, 10); // 2 * 5d
    assert.equal(analysis.reorderPoint, 18); // 8 + 10
    // Deficit = 18 (reorderPoint) - 10 (available) - 6 (inTransit) = 2 -> rounded to minLot 12
    assert.equal(analysis.rawSuggestedQty, 2);
    assert.equal(analysis.suggestedQty, 12);
    assert.equal(analysis.needsReplenishment, true);
  });

  it('never invents demand when product has zero sales (sem_vendas_registradas) or when order query fails (dados_insuficientes)', () => {
    const noSalesAnalysis = analyzeProductReplenishment({
      product: {
        id: 'prod_novo',
        title: 'Vinho Importado Reserva',
        price: 89.9,
        costPrice: 52.0,
        stock: 0,
      },
      orders: [],
      periodDays: 30,
      nowMs: NOW_MS,
    });

    assert.equal(noSalesAnalysis.historyState, 'sem_vendas_registradas');
    assert.equal(noSalesAnalysis.dailyAvgSales, 0);
    assert.equal(noSalesAnalysis.suggestedQty, 0);
    assert.equal(noSalesAnalysis.needsReplenishment, false);
    assert.equal(noSalesAnalysis.urgencyLevel, 'sem_historico');

    const failedOrdersAnalysis = analyzeProductReplenishment({
      product: {
        id: 'prod_1',
        title: 'Arroz Tipo 1 5kg',
        price: 29.9,
        costPrice: 21.0,
        stock: 4,
      },
      orders: null, // Simulates Firestore read failure or permission restriction
      periodDays: 30,
      nowMs: NOW_MS,
    });

    assert.equal(failedOrdersAnalysis.historyState, 'dados_insuficientes');
    assert.equal(failedOrdersAnalysis.suggestedQty, 0);
    assert.equal(failedOrdersAnalysis.needsReplenishment, false);
  });
});

describe('Assistente de Compras — Simulador Financeiro (10, 50, 100 Unidades e Lote)', () => {
  it('computes gross revenue, COGS of sold units, gross profit, purchase outlay and remaining inventory at cost', () => {
    const sim = computeFinancialScenarios({
      unitCost: 10,
      salePrice: 16,
      plannedPurchaseQty: 40,
      freightCost: 20,
      taxCost: 0,
      otherCost: 0,
    });

    // Purchase outlay = 40 * 10 + 20 = 420
    assert.equal(sim.totalPurchaseOutlay, 420);
    assert.equal(sim.unitGrossProfit, 6);
    assert.equal(sim.grossMarginPct, 37.5);
    assert.equal(sim.unitsToRecoverOutlay, 27); // ceil(420 / 16) = 27

    const row10 = sim.scenarios.find((s) => s.quantity === 10)!;
    assert.equal(row10.grossRevenue, 160);
    assert.equal(row10.cogsSoldUnits, 100);
    assert.equal(row10.projectedGrossProfit, 60); // Never subtracts the full 420 outlay from 10 units gross profit!
    assert.equal(row10.unsoldUnitsFromPurchase, 30);
    assert.equal(row10.remainingInventoryValueAtCost, 300);

    const row50 = sim.scenarios.find((s) => s.quantity === 50)!;
    assert.equal(row50.grossRevenue, 800);
    assert.equal(row50.cogsSoldUnits, 500);
    assert.equal(row50.projectedGrossProfit, 300);
    assert.equal(row50.exceedsPlannedPurchase, true);

    const row100 = sim.scenarios.find((s) => s.quantity === 100)!;
    assert.equal(row100.grossRevenue, 1600);
    assert.equal(row100.projectedGrossProfit, 600);
  });

  it('flags warnings for zero cost, zero price or negative margin without NaN/Infinity', () => {
    const sim = computeFinancialScenarios({
      unitCost: 25,
      salePrice: 20,
      plannedPurchaseQty: 10,
    });
    assert.equal(sim.grossMarginPct, -25);
    assert.ok(sim.warnings.some((w) => w.includes('margem negativa')));

    const zeroPrice = computeFinancialScenarios({
      unitCost: 10,
      salePrice: 0,
      plannedPurchaseQty: 10,
    });
    assert.equal(zeroPrice.grossMarginPct, null);
    assert.equal(zeroPrice.unitsToRecoverOutlay, null);
  });
});

describe('Assistente de Compras — Governança de Alçada, Pós-Aprovação e Recebimento', () => {
  const baseApprovedList: PurchaseListRecord = {
    id: 'pl_1',
    code: 'CMP-202604-001',
    title: 'Reposição Bebidas',
    purpose: 'Fim de semana',
    desiredDate: '2026-04-18',
    notes: '',
    status: 'aprovada',
    items: [
      {
        productId: 'p1',
        productTitle: 'Coca-Cola 2L',
        unit: 'UN',
        supplierId: 's1',
        supplierName: 'Forn A',
        requestedQty: 20,
        quotedUnitCost: 7,
        currentSalePrice: 11,
        estimatedItemTotal: 140,
        reason: 'reposicao',
        notes: '',
      },
    ],
    freightCost: 10,
    taxCost: 0,
    otherCost: 0,
    paymentTerms: 'Pix',
    estimatedItemsTotal: 140,
    estimatedGrandTotal: 150,
    approvedLimitTotal: 150,
    effectiveItemsTotal: 140,
    effectiveGrandTotal: 150,
    createdBy: 'u1',
    createdByName: 'Operador',
    createdAt: '2026-04-15T10:00:00Z',
    updatedAt: '2026-04-15T10:00:00Z',
    approvedBy: 'admin1',
    approvedByName: 'Gerente',
    approvedAt: '2026-04-15T11:00:00Z',
    auditTrail: [],
    receiptHistory: [],
  };

  it('invalidates approval if quantity, unit cost, supplier or grand total increases after approval', () => {
    const increasedQty = evaluatePostApprovalChange(
      baseApprovedList,
      [
        {
          ...baseApprovedList.items[0],
          requestedQty: 25,
          estimatedItemTotal: 175,
        },
      ],
      { freightCost: 10, taxCost: 0, otherCost: 0 },
    );
    assert.equal(increasedQty.invalidatesApproval, true);
    assert.ok(increasedQty.reasons.length > 0);

    const changedSupplier = evaluatePostApprovalChange(
      baseApprovedList,
      [
        {
          ...baseApprovedList.items[0],
          supplierId: 's2',
          supplierName: 'Forn B',
        },
      ],
      { freightCost: 10, taxCost: 0, otherCost: 0 },
    );
    assert.equal(changedSupplier.invalidatesApproval, true);
  });

  it('blocks marking a list as fully received when items are pending unless justification is given', () => {
    const partialItems = [
      {
        ...baseApprovedList.items[0],
        purchasedQty: 20,
        receivedQty: 12, // 8 units missing
      },
    ];

    const evalWithoutJustification = evaluatePurchaseReceiptStatus(partialItems);
    assert.equal(evalWithoutJustification.canMarkFullyReceived, false);
    assert.equal(evalWithoutJustification.nextStatus, 'parcialmente_recebida');
    assert.equal(evalWithoutJustification.pendingItemsCount, 1);

    const evalWithJustification = evaluatePurchaseReceiptStatus(
      partialItems,
      'Fornecedor sem estoque para as 8 unidades restantes; pedido encerrado com corte.',
    );
    assert.equal(evalWithJustification.canMarkFullyReceived, true);
    assert.equal(evalWithJustification.nextStatus, 'recebida');

    const fullItems = [
      {
        ...baseApprovedList.items[0],
        purchasedQty: 20,
        receivedQty: 20,
      },
    ];
    const evalFull = evaluatePurchaseReceiptStatus(fullItems);
    assert.equal(evalFull.canMarkFullyReceived, true);
    assert.equal(evalFull.nextStatus, 'recebida');
  });

  it('computes purchase list summary and resolves RBAC permissions cleanly', () => {
    const summary = computePurchaseListSummary({
      items: baseApprovedList.items,
      freightCost: 10,
    });
    assert.equal(summary.estimatedItemsTotal, 140);
    assert.equal(summary.estimatedGrandTotal, 150);
    assert.equal(summary.projectedTotalRevenue, 220);
    assert.equal(summary.projectedGrossProfit, 80);

    const viewerPerms = resolvePurchasingPermissions((reqs) =>
      reqs.includes('relatorios:view'),
    );
    assert.equal(viewerPerms.canView, true);
    assert.equal(viewerPerms.canApproveOrReject, false);
    assert.equal(viewerPerms.canCreateAndSubmitList, false);
  });
});

describe('Assistente de Compras — Porta de Entrada, Anti-Duplicidade e Modelos A / B / C', () => {
  const sampleCatalog = [
    {
      id: 'p_cafe',
      title: 'Café Torrado Especial 500g',
      sku: 'CAF-500',
      ean: '7891234567890',
      unit: 'UN',
      price: 22.9,
      costPrice: 14.5,
      stock: 8,
    },
  ];

  it('prevents duplicate registration by exact SKU, EAN or normalized Name + Unit', () => {
    const bySku = findPotentialDuplicateProducts(
      { title: 'Outro Nome', sku: 'caf-500', unit: 'UN' },
      sampleCatalog,
    );
    assert.equal(bySku.hasExactDuplicate, true);
    assert.equal(bySku.matches[0].reason, 'sku_exato');

    const byEan = findPotentialDuplicateProducts(
      { title: 'Outro Nome', ean: '7891234567890', unit: 'UN' },
      sampleCatalog,
    );
    assert.equal(byEan.hasExactDuplicate, true);
    assert.equal(byEan.matches[0].reason, 'ean_exato');

    const byNameUnit = findPotentialDuplicateProducts(
      { title: '  Cafe   Torrado Especial 500g ', unit: 'un' },
      sampleCatalog,
    );
    assert.equal(byNameUnit.hasExactDuplicate, true);
    assert.equal(byNameUnit.matches[0].reason, 'nome_unidade_exato');
  });

  it('keeps consigned partner stock (Model B) under partner ownership and tracks custody movements without negative balance', () => {
    const baseConsignedOffer: ProductOfferRecord = {
      id: 'off_cons_1',
      productId: 'p_bolo',
      productTitle: 'Bolo Caseiro de Cenoura',
      category: 'Padaria',
      unit: 'UN',
      originChannel: 'parceiro_consignado_mercado',
      ownership: 'parceiro',
      storageLocation: 'mercado',
      partnerLifecycleStatus: 'aprovado',
      partnerId: 'prt_1',
      partnerName: 'Confeitaria Dona Flor',
      salePrice: 25,
      consignedPhysicalQty: 0,
      consignedReservedQty: 0,
      consignedAvailableQty: 0,
      consignedDamagedOrLostQty: 0,
      partnerReportedAvailableQty: 0,
      inclusionJustification: 'Consignação diária',
      createdBy: 'u1',
      createdByName: 'Operador',
      createdAt: '2026-04-15T10:00:00Z',
      updatedAt: '2026-04-15T10:00:00Z',
      auditTrail: [],
    };

    // 1. Entry in custody (+15)
    const afterReceipt = applyCustodyMovementToOffer(
      baseConsignedOffer,
      'recebimento_consignacao',
      15,
    );
    assert.equal(afterReceipt.consignedPhysicalQty, 15);
    assert.equal(afterReceipt.consignedAvailableQty, 15);

    const offerWith15: ProductOfferRecord = {
      ...baseConsignedOffer,
      ...afterReceipt,
    };

    // 2. Reserve 3 units for an order
    const afterReserve = applyCustodyMovementToOffer(
      offerWith15,
      'reserva_pedido',
      3,
    );
    assert.equal(afterReserve.consignedPhysicalQty, 15);
    assert.equal(afterReserve.consignedReservedQty, 3);
    assert.equal(afterReserve.consignedAvailableQty, 12);

    // 3. Deduct 3 sold units
    const afterSale = applyCustodyMovementToOffer(
      { ...offerWith15, ...afterReserve },
      'baixa_venda_consignada',
      3,
    );
    assert.equal(afterSale.consignedPhysicalQty, 12);
    assert.equal(afterSale.consignedReservedQty, 0);
    assert.equal(afterSale.consignedAvailableQty, 12);

    // 4. Rejects excessive deduction that would cause negative custody
    assert.throws(() =>
      applyCustodyMovementToOffer(offerWith15, 'devolucao_ao_parceiro', 50),
    );
  });

  it('automatically expires external partner availability (Model C) when past validity window', () => {
    const now = new Date('2026-04-15T15:00:00Z');
    const validOffer = {
      originChannel: 'parceiro_retirada_estabelecimento' as const,
      partnerReportedAvailableQty: 12,
      availabilityConfirmedAt: '2026-04-15T10:00:00Z',
      availabilityExpiresAt: '2026-04-16T10:00:00Z',
      consignedAvailableQty: 0,
    };
    const validCheck = isPartnerOfferAvailabilityExpired(validOffer, now);
    assert.equal(validCheck.isExpired, false);
    assert.equal(validCheck.isSellableQtyPositive, true);
    assert.equal(validCheck.effectiveAvailableQty, 12);

    const expiredOffer = {
      ...validOffer,
      availabilityExpiresAt: '2026-04-15T12:00:00Z', // 3h ago
    };
    const expiredCheck = isPartnerOfferAvailabilityExpired(expiredOffer, now);
    assert.equal(expiredCheck.isExpired, true);
    assert.equal(expiredCheck.isSellableQtyPositive, false);
    assert.equal(expiredCheck.effectiveAvailableQty, 0);
  });

  it('computes 10/50/100 partner scenarios separating customer GMV, partner payout, Mercado commission and attributable costs with zero purchase outlay', () => {
    const sim = computePartnerFinancialScenarios({
      salePrice: 30,
      plannedAvailableQty: 25,
      rule: {
        version: 1,
        ruleType: 'percentual_comissao',
        commissionPct: 20, // R$ 6.00 commission to Mercado, R$ 24.00 to Partner
        deliveryCostPerUnit: 1.5,
        packagingCostPerUnit: 0.5,
        paymentFeePct: 0,
        validFrom: '2026-04-01',
        fiscalResponsibilityPolicy: 'definicao_pendente',
      },
    });

    assert.equal(sim.unitSplit.partnerUnitRepasse, 24);
    assert.equal(sim.unitSplit.mercadoUnitGrossCommission, 6);
    assert.equal(sim.unitSplit.attributableUnitCost, 2);
    assert.equal(sim.unitSplit.mercadoUnitContribution, 4);

    const s10 = sim.scenarios.find((r) => r.quantity === 10)!;
    assert.equal(s10.customerGrossRevenue, 300);
    assert.equal(s10.partnerRepasseTotal, 240);
    assert.equal(s10.mercadoGrossCommissionTotal, 60);
    assert.equal(s10.attributableCostsTotal, 20);
    assert.equal(s10.mercadoEstimatedContribution, 40);
    assert.equal(s10.mercadoPurchaseOutlay, 0);
  });

  it('invalidates product/offer approval if price, cost, partner, supplier or commercial rule changes after approval', () => {
    const approvedPartnerOffer: ProductOfferRecord = {
      id: 'off_2',
      productId: 'p_pizza',
      productTitle: 'Pizza Artesanal Mussarela',
      category: 'Congelados',
      unit: 'UN',
      originChannel: 'parceiro_retirada_estabelecimento',
      ownership: 'parceiro',
      storageLocation: 'estabelecimento_parceiro',
      partnerLifecycleStatus: 'ativo',
      partnerId: 'prt_pizzaria',
      partnerName: 'Pizzaria Napoli',
      salePrice: 45,
      consignedPhysicalQty: 0,
      consignedReservedQty: 0,
      consignedAvailableQty: 0,
      consignedDamagedOrLostQty: 0,
      partnerReportedAvailableQty: 10,
      inclusionJustification: 'Parceria local',
      createdBy: 'u1',
      createdByName: 'Operador',
      createdAt: '2026-04-15T10:00:00Z',
      updatedAt: '2026-04-15T10:00:00Z',
      auditTrail: [],
    };

    const priceChange = evaluatePostApprovalOfferChange(approvedPartnerOffer, {
      salePrice: 49.9,
    });
    assert.equal(priceChange.invalidatesApproval, true);
    assert.ok(priceChange.reasons[0].includes('Preço de venda alterado'));
  });

  it('never counts partner payout share as Mercado own revenue in financial separation report and resolves order fulfillment sources', () => {
    const partnerOffer: ProductOfferRecord = {
      id: 'off_padaria',
      productId: 'prod_pao',
      productTitle: 'Cesta Café da Manhã Parceiro',
      category: 'Padaria',
      unit: 'UN',
      originChannel: 'parceiro_retirada_estabelecimento',
      ownership: 'parceiro',
      storageLocation: 'estabelecimento_parceiro',
      partnerLifecycleStatus: 'ativo',
      partnerId: 'prt_padaria',
      partnerName: 'Padaria Real',
      salePrice: 100,
      commercialRule: {
        version: 1,
        ruleType: 'percentual_comissao',
        commissionPct: 15, // R$ 15 Mercado, R$ 85 Partner
        deliveryCostPerUnit: 3,
        packagingCostPerUnit: 0,
        paymentFeePct: 0,
        validFrom: '2026-04-01',
        fiscalResponsibilityPolicy: 'definicao_pendente',
      },
      consignedPhysicalQty: 0,
      consignedReservedQty: 0,
      consignedAvailableQty: 0,
      consignedDamagedOrLostQty: 0,
      partnerReportedAvailableQty: 10,
      inclusionJustification: 'Parceria',
      createdBy: 'u1',
      createdByName: 'Operador',
      createdAt: '2026-04-15T10:00:00Z',
      updatedAt: '2026-04-15T10:00:00Z',
      auditTrail: [],
    };

    const orders = [
      {
        id: 'ord_100',
        status: 'delivered',
        paymentStatus: 'approved',
        items: [
          { id: 'prod_proprio', title: 'Refrigerante 2L', quantity: 2, price: 10 }, // R$ 20 own
          { id: 'prod_pao', title: 'Cesta Café da Manhã Parceiro', quantity: 1, price: 100 }, // R$ 100 partner (85 partner, 15 Mercado)
        ],
      },
    ];

    const report = computeFinancialSeparationReport({
      orders,
      products: [{ id: 'prod_proprio', title: 'Refrigerante 2L', price: 10, costPrice: 6 }],
      offers: [partnerOffer],
      settlements: [],
    });

    assert.equal(report.totalCustomerGmv, 120);
    assert.equal(report.ownProductsGrossRevenue, 20);
    assert.equal(report.ownProductsGrossProfit, 8); // 20 - 12
    assert.equal(report.partnerSalesCustomerTotal, 100);
    assert.equal(report.partnerRepasseTotalDue, 85); // Strictly segregated for the partner!
    assert.equal(report.mercadoPartnerGrossCommission, 15);
    assert.equal(report.mercadoPartnerNetContribution, 12); // 15 - 3 delivery cost
    // Mercado true recognized revenue = 20 (own) + 15 (commission) = 35 (NEVER 120!)
    assert.equal(report.mercadoTrueRecognizedRevenue, 35);

    const plan = resolveOrderFulfillmentPlan(orders[0], [partnerOffer]);
    assert.equal(plan.hasExternalPickupItems, true);
    assert.equal(plan.items[0].originChannel, 'mercado_proprio');
    assert.equal(plan.items[1].originChannel, 'parceiro_retirada_estabelecimento');
    assert.equal(plan.items[1].ownership, 'parceiro');

    const diag = diagnoseCatalogOrigins(
      [
        { id: 'prod_proprio', title: 'Refrigerante 2L', price: 10, costPrice: 6 },
        { id: 'prod_legado_sem_custo', title: 'Item Antigo', price: 5 },
      ],
      [partnerOffer],
      {},
    );
    assert.equal(diag.mappedOwnProductsCount, 1);
    assert.equal(diag.unclassifiedLegacyCount, 1);
  });
});
