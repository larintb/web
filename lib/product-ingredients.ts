export interface IngredientData {
  items: string[];
  comboAdd?: string[];
}

const MAP: { pattern: RegExp; items: string[]; comboAdd?: string[] }[] = [
  {
    pattern: /3.*(tender|tira)/i,
    items: ['3 Tiras de Pollo Crujiente', '1 Salsa Charles'],
    comboAdd: ['Papas Fritas', 'Pan Estilo Texas'],
  },
  {
    pattern: /4.*(tender|tira)/i,
    items: ['4 Tiras de Pollo Crujiente', '1 Salsa Charles'],
    comboAdd: ['Papas Fritas', 'Pan Estilo Texas'],
  },
  {
    pattern: /6.*(tender|tira)/i,
    items: ['6 Tiras de Pollo Crujiente', '1 Salsa Charles'],
    comboAdd: ['Papas Fritas', 'Pan Estilo Texas'],
  },
  {
    pattern: /classic.*sandwich/i,
    items: ['Pollo Crujiente', 'Pan Brioche', 'Lechuga', 'Tomate', 'Mayonesa'],
    comboAdd: ['Papas Fritas', '1 Salsa Charles'],
  },
  {
    pattern: /hot.*sandwich/i,
    items: ['Pollo Crujiente Picante', 'Pan Brioche', 'Lechuga', 'Tomate', 'Salsa Picante'],
    comboAdd: ['Papas Fritas', '1 Salsa Charles'],
  },
  {
    pattern: /texas.*(sandwich.*combo|combo.*sandwich)/i,
    items: ['Pollo Crujiente', 'Pan Texas Tostado', 'Papas Fritas', '1 Salsa Charles', 'Refresco'],
  },
  {
    pattern: /texas.*sandwich/i,
    items: ['Pollo Crujiente', 'Pan Texas Tostado', 'Lechuga', 'Tomate', 'Mostaza'],
    comboAdd: ['Papas Fritas', '1 Salsa Charles'],
  },
  {
    pattern: /spicy.*fries|special.*fries/i,
    items: ['Papas Fritas Crujientes', 'Sazón Especial Picante', '1 Salsa Charles'],
  },
  {
    pattern: /fries|papas/i,
    items: ['Papas Fritas Doradas', '1 Salsa Charles'],
  },
  {
    pattern: /mac.*cheese|macarr/i,
    items: ['Macarrones', 'Queso Cremoso', 'Queso Cheddar'],
  },
  {
    pattern: /box.*combo/i,
    items: ['Pollo Crujiente', 'Papas Fritas', 'Pan Texas', '1 Salsa Charles', 'Refresco'],
  },
];

export function getIngredientData(productName: string): IngredientData | undefined {
  return MAP.find(m => m.pattern.test(productName));
}
