import { PrismaClient, EquipmentStatus, PurchaseMode, FailureRateMode } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // ─── Usuário admin ────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@criaforma.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@criaforma.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Usuário: ${admin.email}`);

  // ─── Domain tables (ensure seeded) ───────────────────────────
  // Filament types
  const [ftPla, ftPetg] = await Promise.all([
    prisma.filamentType.upsert({ where: { name: 'PLA' },  update: {}, create: { name: 'PLA',  sortOrder: 1 } }),
    prisma.filamentType.upsert({ where: { name: 'PETG' }, update: {}, create: { name: 'PETG', sortOrder: 2 } }),
  ]);

  // Brands
  const brandCreality = await prisma.brand.upsert({ where: { name: 'Creality' }, update: {}, create: { name: 'Creality' } });

  // Colors
  const [colorWhite, colorBlack, colorTransp] = await Promise.all([
    prisma.color.upsert({ where: { name: 'Branco' },      update: {}, create: { name: 'Branco',      hexCode: '#FFFFFF' } }),
    prisma.color.upsert({ where: { name: 'Preto' },       update: {}, create: { name: 'Preto',       hexCode: '#000000' } }),
    prisma.color.upsert({ where: { name: 'Transparente'}, update: {}, create: { name: 'Transparente' } }),
  ]);

  // Units
  const unitUn = await prisma.unit.upsert({ where: { name: 'Unidade' }, update: {}, create: { name: 'Unidade', symbol: 'un' } });

  // Accessory categories
  const [catEmb, catChav, catIlum, catAcab] = await Promise.all([
    prisma.accessoryCategory.upsert({ where: { name: 'Embalagem' },   update: {}, create: { name: 'Embalagem' } }),
    prisma.accessoryCategory.upsert({ where: { name: 'Chaveiro' },    update: {}, create: { name: 'Chaveiro' } }),
    prisma.accessoryCategory.upsert({ where: { name: 'Iluminação' },  update: {}, create: { name: 'Iluminação' } }),
    prisma.accessoryCategory.upsert({ where: { name: 'Acabamento' },  update: {}, create: { name: 'Acabamento' } }),
  ]);
  console.log('✅ Tabelas de domínio');

  // ─── Fornecedor ───────────────────────────────────────────────
  const supplier = await prisma.supplier.upsert({
    where: { id: 'seed-supplier-1' },
    update: {},
    create: {
      id: 'seed-supplier-1',
      name: '3D Lab Brasil',
      contactName: 'Carlos Santos',
      email: 'contato@3dlabbrasil.com',
      phone: '(11) 99999-0000',
      website: 'https://3dlabbrasil.com',
      notes: 'Fornecedor principal de filamentos',
    },
  });
  console.log(`✅ Fornecedor: ${supplier.name}`);

  // ─── Equipamento ──────────────────────────────────────────────
  const equipment = await prisma.equipment.upsert({
    where: { id: 'seed-equipment-1' },
    update: {},
    create: {
      id: 'seed-equipment-1',
      name: 'Creality Hi Combo',
      brandId: brandCreality.id,
      model: 'Hi',
      purchasePrice: 4700.0,
      purchaseDate: new Date('2024-01-15'),
      estimatedLifespanHours: 6000,
      ratedPowerWatts: 1150,
      avgPowerWatts: 400,
      buildVolumeX: 400,
      buildVolumeY: 400,
      buildVolumeZ: 450,
      maxSpeedMmS: 600,
      totalPrintHours: 0,
      status: EquipmentStatus.AVAILABLE,
      notes: 'Impressora principal com sistema CFS multi-material',
    },
  });
  console.log(`✅ Equipamento: ${equipment.name}`);

  // ─── Materiais ────────────────────────────────────────────────
  const plaWhite = await prisma.material.upsert({
    where: { id: 'seed-material-pla-white' },
    update: {},
    create: {
      id: 'seed-material-pla-white',
      filamentTypeId: ftPla.id,
      brandId: brandCreality.id,
      diameterMm: 1.75,
      densityKgM3: 1240,
      spoolWeightG: 1000,
      supplierId: supplier.id,
      recommendedTempNozzleMin: 190,
      recommendedTempNozzleMax: 220,
      recommendedTempBedMin: 50,
      recommendedTempBedMax: 60,
    },
  });

  const plaBlack = await prisma.material.upsert({
    where: { id: 'seed-material-pla-black' },
    update: {},
    create: {
      id: 'seed-material-pla-black',
      filamentTypeId: ftPla.id,
      brandId: brandCreality.id,
      diameterMm: 1.75,
      densityKgM3: 1240,
      spoolWeightG: 1000,
      supplierId: supplier.id,
      recommendedTempNozzleMin: 190,
      recommendedTempNozzleMax: 220,
      recommendedTempBedMin: 50,
      recommendedTempBedMax: 60,
    },
  });

  const petgTransp = await prisma.material.upsert({
    where: { id: 'seed-material-petg-transp' },
    update: {},
    create: {
      id: 'seed-material-petg-transp',
      filamentTypeId: ftPetg.id,
      brandId: brandCreality.id,
      diameterMm: 1.75,
      densityKgM3: 1270,
      spoolWeightG: 1000,
      supplierId: supplier.id,
      recommendedTempNozzleMin: 230,
      recommendedTempNozzleMax: 250,
      recommendedTempBedMin: 70,
      recommendedTempBedMax: 85,
    },
  });
  console.log(`✅ Materiais: ${plaWhite.id}, ${plaBlack.id}, ${petgTransp.id}`);

  // ─── Estoque de material ──────────────────────────────────────
  await prisma.materialStock.upsert({
    where: { id: 'seed-stock-pla-white-1' },
    update: {},
    create: {
      id: 'seed-stock-pla-white-1',
      materialId: plaWhite.id,
      spoolLabel: 'PLA-BRC-001',
      initialWeightG: 1000,
      currentWeightG: 1000,
      status: 'SEALED',
      costPerKg: 95.0,
      purchaseDate: new Date('2024-03-01'),
    },
  });

  // ─── Acessórios ───────────────────────────────────────────────
  const accessories = [
    {
      id: 'seed-acc-saquinho',
      name: 'Saquinho zip 10x15',
      description: 'Saquinho transparente com fechamento zip para embalagem',
      categoryId: catEmb.id,
      unitId: unitUn.id,
      purchaseMode: PurchaseMode.BOX,
      purchaseQuantity: 500,
      purchaseCost: 45.0,
      costPerUnit: 0.09,
      stockQuantity: 500,
      minStockAlert: 100,
    },
    {
      id: 'seed-acc-caixa',
      name: 'Caixa presente P',
      description: 'Caixa kraft pequena para presente',
      categoryId: catEmb.id,
      unitId: unitUn.id,
      purchaseMode: PurchaseMode.PACK,
      purchaseQuantity: 25,
      purchaseCost: 62.5,
      costPerUnit: 2.5,
      stockQuantity: 50,
      minStockAlert: 10,
    },
    {
      id: 'seed-acc-argola',
      name: 'Argola chaveiro 25mm',
      description: 'Argola metálica para chaveiro 25mm',
      categoryId: catChav.id,
      unitId: unitUn.id,
      purchaseMode: PurchaseMode.PACK,
      purchaseQuantity: 100,
      purchaseCost: 80.0,
      costPerUnit: 0.8,
      stockQuantity: 200,
      minStockAlert: 50,
    },
    {
      id: 'seed-acc-led',
      name: 'LED 3mm branco',
      description: 'LED 3mm difuso branco para enfeites',
      categoryId: catIlum.id,
      unitId: unitUn.id,
      purchaseMode: PurchaseMode.PACK,
      purchaseQuantity: 50,
      purchaseCost: 25.0,
      costPerUnit: 0.5,
      stockQuantity: 100,
      minStockAlert: 20,
    },
    {
      id: 'seed-acc-cola-uv',
      name: 'Cola UV 25g',
      description: 'Cola curada por luz UV para acabamento',
      categoryId: catAcab.id,
      unitId: unitUn.id,
      purchaseMode: PurchaseMode.UNIT,
      purchaseQuantity: 1,
      purchaseCost: 35.0,
      costPerUnit: 35.0,
      stockQuantity: 3,
      minStockAlert: 1,
    },
  ];

  for (const acc of accessories) {
    await prisma.accessory.upsert({
      where: { id: acc.id },
      update: {},
      create: {
        ...acc,
        supplierId: supplier.id,
      },
    });
  }
  console.log(`✅ Acessórios: ${accessories.length} cadastrados`);

  // ─── Categorias ───────────────────────────────────────────────
  const catChaveiros = await prisma.category.upsert({
    where: { slug: 'chaveiros' },
    update: {},
    create: {
      name: 'Chaveiros',
      slug: 'chaveiros',
      description: 'Chaveiros personalizados em 3D',
      sortOrder: 1,
    },
  });

  const catMiniaturas = await prisma.category.upsert({
    where: { slug: 'miniaturas' },
    update: {},
    create: {
      name: 'Miniaturas',
      slug: 'miniaturas',
      description: 'Miniaturas e figuras colecionáveis',
      sortOrder: 2,
    },
  });

  const catUtilitarios = await prisma.category.upsert({
    where: { slug: 'utilitarios' },
    update: {},
    create: {
      name: 'Utilitários',
      slug: 'utilitarios',
      description: 'Peças funcionais e utilitários domésticos',
      sortOrder: 3,
    },
  });
  console.log(`✅ Categorias: ${catChaveiros.name}, ${catMiniaturas.name}, ${catUtilitarios.name}`);

  // ─── Configuração de Custos Padrão ───────────────────────────
  const costConfig = await prisma.costConfig.upsert({
    where: { id: 'seed-cost-config-default' },
    update: {},
    create: {
      id: 'seed-cost-config-default',
      name: 'Padrão (São Paulo)',
      isDefault: true,
      electricityCostPerKwh: 0.8,
      failureRateMode: FailureRateMode.HYBRID,
      failureRatePercent: 5.0,
      failureAutoWindowDays: 90,
      failureAutoMinSamples: 20,
      notes: 'Perfil padrão baseado em tarifa SP (Enel) + Creality Hi',
    },
  });
  console.log(`✅ Config de Custos: ${costConfig.name}`);

  // ─── Produto exemplo ──────────────────────────────────────────
  await prisma.product.upsert({
    where: { id: 'seed-product-chaveiro-generic' },
    update: {},
    create: {
      id: 'seed-product-chaveiro-generic',
      name: 'Chaveiro Genérico',
      description: 'Chaveiro personalizado impresso em PLA. Pode ser customizado com qualquer design.',
      categoryId: catChaveiros.id,
      estimatedPrintTimeMinutes: 871,
      estimatedMaterialG: 297.6,
      piecesPerPrint: 25,
      recommendedFilamentTypeId: ftPla.id,
      recommendedLayerHeightMm: 0.2,
      recommendedInfillPercent: 15,
      supportsRequired: false,
      defaultAccessories: [
        { accessory_id: 'seed-acc-argola', qty_per_unit: 1 },
        { accessory_id: 'seed-acc-saquinho', qty_per_unit: 1 },
      ],
      photos: [],
      printFiles: [],
    },
  });
  console.log(`✅ Produto: Chaveiro Genérico`);

  // ─── Cliente exemplo ──────────────────────────────────────────
  await prisma.customer.upsert({
    where: { id: 'seed-customer-1' },
    update: {},
    create: {
      id: 'seed-customer-1',
      name: 'João Silva',
      email: 'joao.silva@exemplo.com',
      phone: '(11) 98888-1234',
      notes: 'Cliente frequente, prefere embalagem com caixa presente',
    },
  });
  console.log(`✅ Cliente: João Silva`);

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('────────────────────────────────────────');
  console.log('📧 Login: admin@criaforma.com');
  console.log('🔑 Senha: admin123');
  console.log('────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
