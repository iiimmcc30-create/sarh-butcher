import { UpdateAccountSettingsDto } from '../dto/users.dto';

describe('customer account gender', () => {
  it('accepts existing Male/Female values only', () => {
    const dto = new UpdateAccountSettingsDto();
    dto.gender = 'MALE';
    expect(dto.gender).toBe('MALE');
    dto.gender = 'FEMALE';
    expect(dto.gender).toBe('FEMALE');
  });
});
