const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.rGBVariety.findMany({ select: { name: true, stockQuantity: true } })
  .then(rows => {
    console.log(JSON.stringify(rows, null, 2));
    return p.$disconnect();
  })
  .catch(e => {
    console.error('Error:', e.message);
    return p.$disconnect();
  });
