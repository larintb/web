-- Crispy Charles — Asignar image_url a cada producto
-- Pega esto en el SQL Editor de Supabase y ejecuta

UPDATE products SET image_url = '/images/3tenders.jpeg'
  WHERE name ILIKE '%3%tender%';

UPDATE products SET image_url = '/images/4tenders.jpeg'
  WHERE name ILIKE '%4%tender%';

UPDATE products SET image_url = '/images/6tenders.jpeg'
  WHERE name ILIKE '%6%tender%';

UPDATE products SET image_url = '/images/classic_sandwich.jpeg'
  WHERE name ILIKE '%classic%sandwich%';

UPDATE products SET image_url = '/images/hot_sandwich.jpeg'
  WHERE name ILIKE '%hot%sandwich%';

-- Texas Sandwich Combo primero (más específico)
UPDATE products SET image_url = '/images/texas_sandwich_combo.jpeg'
  WHERE name ILIKE '%texas%' AND name ILIKE '%combo%';

-- Texas Sandwich sin combo
UPDATE products SET image_url = '/images/texas_sandwich.jpeg'
  WHERE name ILIKE '%texas%sandwich%' AND name NOT ILIKE '%combo%';

UPDATE products SET image_url = '/images/spicy_fries.jpeg'
  WHERE name ILIKE '%spicy%' OR name ILIKE '%picante%';

UPDATE products SET image_url = '/images/special_fries.jpeg'
  WHERE name ILIKE '%special%fries%' OR name ILIKE '%especial%';

UPDATE products SET image_url = '/images/box_combo.jpeg'
  WHERE name ILIKE '%box%combo%';

UPDATE products SET image_url = '/images/mac_cheese.jpeg'
  WHERE name ILIKE '%mac%' OR name ILIKE '%cheese%';

-- Verificar resultado
SELECT id, name, image_url FROM products ORDER BY display_order;
