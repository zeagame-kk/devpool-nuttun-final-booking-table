# Sample restaurant photos

Pictures for the five sample restaurants in `api/seed/seed.sql`. All are free to use under the
[Unsplash License](https://unsplash.com/license) (commercial use allowed, credit not required but given here).
They are illustrations: they do **not** show the fictional restaurants that carry their names. Each was
fetched from Unsplash's image service at 1200x800 (centre crop) as a JPEG.

| File | Restaurant | Photo | Photographer |
| --- | --- | --- | --- |
| `9001-seed.jpg` | ชาบูทองคำ | [Sliced vegetables on stainless steel cooking pot](https://unsplash.com/photos/muV_8wy4mzw) | Cera ([@cerachiuu](https://unsplash.com/@cerachiuu)) |
| `9002-seed.jpg` | หมูกระทะบ้านสวน | [Meat sizzling on a hot grill with steam rising](https://unsplash.com/photos/oiS-Tjtemvs) | Stanley Kustamin ([@kyelnats](https://unsplash.com/@kyelnats)) |
| `9003-seed.jpg` | ยากินิกุโตเกียว | [Meat and vegetables grilling on a circular barbecue](https://unsplash.com/photos/g68m5V_jkDE) | You Le ([@le_y0u](https://unsplash.com/@le_y0u)) |
| `9004-seed.jpg` | ปิ้งย่างลุงหนวด | [Grilled meat on charcoal grill](https://unsplash.com/photos/gH9vt0v6EHY) | Sincerely Media ([@sincerelymedia](https://unsplash.com/@sincerelymedia)) |
| `9005-seed.jpg` | ชาบูหม้อไฟเจ้าเก่า | [A pot of soup on top of a stove](https://unsplash.com/photos/R_eO1SjCm2Q) | You Le ([@le_y0u](https://unsplash.com/@le_y0u)) |

The file name must stay `<restaurant id>-seed.jpg`: `seed.sql` points `image_url` at
`/uploads/restaurants/<id>-seed.jpg`, and `scripts/seed_images.sh` copies the files there.

`web/public/hero.jpg` (the picture at the top of the landing page for visitors who are not signed in) is a copy of
`9002-seed.jpg`, so the credit in the table above applies to it too.
