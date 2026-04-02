-- Crispy Charles — Asignar image_url a cada extra
-- Los ILIKE ignoran el emoji que pusiste al final del nombre

UPDATE extras SET image_url = '/images/texas_toast_icon.png'
  WHERE name ILIKE '%texas toast%';

UPDATE extras SET image_url = '/images/salsa_charles_icono.png'
  WHERE name ILIKE '%charle%' OR name ILIKE '%charles%';

UPDATE extras SET image_url = '/images/chiles_weros_icono.png'
  WHERE name ILIKE '%chile%wero%' OR name ILIKE '%chiles%';

UPDATE extras SET image_url = '/images/salsa_buffalo_icono.png'
  WHERE name ILIKE '%buffalo%';

UPDATE extras SET image_url = '/images/salsa_queso_icono.png'
  WHERE name ILIKE '%salsa%queso%';

UPDATE extras SET image_url = '/images/ranch_icono.png'
  WHERE name ILIKE '%ranch%';

UPDATE extras SET image_url = '/images/queso_amarillo_icono.png'
  WHERE name ILIKE '%queso%hamburguesa%' OR name ILIKE '%queso%amarillo%';

-- Verificar resultado
SELECT id, name, image_url FROM extras ORDER BY display_order;
