database name: exd_products
schema/table: products

products {id, name, image, price, status, createdAt, updatedAt, userId }

POST /products (USER)
GET /products (USER, GUEST)
