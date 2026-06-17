import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDymI1qb9b2NOpZElTWsV-SzXB_54fLtjw",
  authDomain: "nosso-mercado-4b877.firebaseapp.com",
  projectId: "nosso-mercado-4b877",
  storageBucket: "nosso-mercado-4b877.firebasestorage.app",
  messagingSenderId: "297048767484",
  appId: "1:297048767484:web:4338a4f08c607b2335d079",
  measurementId: "G-VX2TZLWN1X"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching products from Firestore...");
  const productsSnap = await getDocs(collection(db, "products"));
  const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Found ${products.length} products.`);

  // Group products by category
  const productsByCategory = {};
  products.forEach(p => {
    const cat = p.category;
    if (!cat) return;
    if (!productsByCategory[cat]) {
      productsByCategory[cat] = [];
    }
    productsByCategory[cat].push(p.id);
  });

  console.log("Categories found in catalog:", Object.keys(productsByCategory));

  console.log("Fetching current vitrines...");
  const vitrinesSnap = await getDocs(collection(db, "home-config", "data", "vitrines"));
  const existingVitrines = vitrinesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Found ${existingVitrines.length} existing vitrines.`);
  const existingTitles = new Set(existingVitrines.map(v => v.title.toLowerCase()));

  // Let's define the 20 main categories from category row in Home.tsx:
  const targetCategories = [
    { title: "Bebidas", theme: "purple", subtitle: ["Gelada é aqui! 🧊", "As melhores marcas", "Refresque seu dia"] },
    { title: "Alimentos", theme: "orange", subtitle: ["Descubra novidades exclusivas!", "Sabor inconfundível", "Ofertas especiais"] },
    { title: "Limpeza", theme: "green", subtitle: ["Deixo tudo brilhando ✨", "Limpeza pesada", "Fragrâncias únicas"] },
    { title: "Promoções", theme: "orange", subtitle: "As melhores ofertas da semana!" },
    { title: "Padaria", theme: "orange", subtitle: "Pães quentinhos e doces frescos!" },
    { title: "Congelados", theme: "purple", subtitle: "Praticidade para o seu dia a dia!" },
    { title: "Pet Shop", theme: "green", subtitle: "Tudo para o seu melhor amigo!" },
    { title: "Salgadinhos", theme: "purple", subtitle: "Para curtir aquele filme ou jogo!" },
    { title: "Doces", theme: "orange", subtitle: "Açúcar e felicidade em cada mordida!" },
    { title: "Biscoitos", theme: "orange", subtitle: "Perfeitos para acompanhar o café!" },
    { title: "Beleza", theme: "purple", subtitle: "Seu ritual de cuidados diários!" },
    { title: "Eletrônicos", theme: "purple", subtitle: "Tecnologia de ponta ao seu alcance!" },
    { title: "Tabacaria", theme: "green", subtitle: "Variedade de sedas, isqueiros e importados!" },
    { title: "Sorvetes", theme: "purple", subtitle: "Refresque-se com o melhor sabor!" },
    { title: "Utilidades", theme: "green", subtitle: "Facilidades para o seu lar!" },
    { title: "Churrasco", theme: "orange", subtitle: "Tudo para o churrasco perfeito!" },
    { title: "Adega", theme: "purple", subtitle: "Vinhos e destilados selecionados!" },
    { title: "Bomboniere", theme: "orange", subtitle: "Guloseimas irresistíveis!" },
    { title: "Higiene", theme: "green", subtitle: "Sua saúde e higiene pessoal em dia!" },
    { title: "Fitness", theme: "purple", subtitle: "Itens para manter a energia e o foco!" },
    { title: "Combos", theme: "orange", subtitle: "Leve mais por muito menos!" }
  ];

  console.log("Checking and creating missing vitrines...");
  let order = existingVitrines.reduce((max, v) => Math.max(max, v.order ?? 0), 0) + 1;
  const batch = writeBatch(db);

  for (const cat of targetCategories) {
    if (existingTitles.has(cat.title.toLowerCase())) {
      console.log(`Vitrine "${cat.title}" already exists. Skipping.`);
      continue;
    }

    // Try to find products by category name matching
    let matchedProductIds = [];
    const categoryKey = Object.keys(productsByCategory).find(
      k => k.toLowerCase() === cat.title.toLowerCase()
    );
    
    if (categoryKey) {
      matchedProductIds = productsByCategory[categoryKey];
    } else {
      matchedProductIds = products
        .filter(p => p.category?.toLowerCase() === cat.title.toLowerCase() || p.title?.toLowerCase().includes(cat.title.toLowerCase()))
        .map(p => p.id);
    }

    console.log(`Creating vitrine for "${cat.title}" with ${matchedProductIds.length} products.`);

    const slug = cat.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
    const docRef = doc(db, "home-config", "data", "vitrines", slug);
    
    const vitrineData = {
      title: cat.title,
      subtitle: cat.subtitle,
      theme: cat.theme,
      active: true,
      order: order++,
      layout: "horizontal",
      maxProducts: 6,
      productIds: matchedProductIds.slice(0, 6)
    };

    batch.set(docRef, vitrineData);
  }

  await batch.commit();
  console.log("Batch commit completed successfully!");
}

run().catch(console.error);
