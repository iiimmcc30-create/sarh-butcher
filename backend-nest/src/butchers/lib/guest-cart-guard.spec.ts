import { readFileSync } from 'fs';
import { join } from 'path';

describe('guest cannot use protected butcher customer APIs', () => {
  const controller = readFileSync(
    join(__dirname, '../butchers.controller.ts'),
    'utf8',
  );

  it('checkout and order creation require the current customer JWT', () => {
    expect(controller).toContain("async createCheckout(@CurrentUser() user: JwtPayload");
    expect(controller).toContain("async createOrder(@CurrentUser() user: JwtPayload");
    expect(controller).toContain("async addFavorite(@Param('id') id: string, @CurrentUser() user: JwtPayload");
  });
});
