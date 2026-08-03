-- 0030_packaging_demo_images.sql — Populate realistic product photos for standard packaging items.

INSERT INTO public.packaging_items (name, normalized_name, packaging_type, unit, unit_price, image_url)
VALUES
  ('Pizza Box',   'pizza box',   'primary',   'Piece', 4.50, '/demo/photos/pizza-box.jpg'),
  ('Burger Box',  'burger box',  'primary',   'Piece', 3.50, '/demo/photos/burger-box.jpg'),
  ('Paper Bag',   'paper bag',   'secondary', 'Piece', 2.00, '/demo/photos/paper-bag.jpg'),
  ('Sauce Cup',   'sauce cup',   'primary',   'Piece', 1.50, '/demo/photos/sauce-cup.jpg'),
  ('Dessert Box', 'dessert box', 'primary',   'Piece', 5.00, '/demo/photos/dessert-box.jpg'),
  ('Cup',         'cup',         'primary',   'Piece', 2.50, '/demo/photos/cup.jpg'),
  ('Lid',         'lid',         'primary',   'Piece', 1.00, '/demo/photos/cup.jpg'),
  ('Sticker',     'sticker',     'tertiary',  'Piece', 0.50, '/demo/photos/paper-bag.jpg'),
  ('Fork',        'fork',        'secondary', 'Piece', 0.80, '/demo/photos/burger-box.jpg'),
  ('Spoon',       'spoon',       'secondary', 'Piece', 0.80, '/demo/photos/burger-box.jpg')
ON CONFLICT (normalized_name) DO UPDATE SET
  image_url = EXCLUDED.image_url;

