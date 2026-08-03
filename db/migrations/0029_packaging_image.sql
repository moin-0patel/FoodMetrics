-- 0029_packaging_image.sql — Add photo/image URL to packaging items.

alter table public.packaging_items 
  add column if not exists image_url text;
