import { MessagesService } from './messages.service';
import { ApiException } from '../common/exceptions/api.exception';

describe('MessagesService.sendMessage block enforcement', () => {
  const repo = {
    upsertThread: jest.fn(),
    createMessage: jest.fn(),
  };
  const policy = {
    assertCanSendMessage: jest.fn(),
  };
  const logger = { info: jest.fn() };
  const notifications = { notifyUser: jest.fn() };
  const sockets = { emitToThread: jest.fn(), emitToUser: jest.fn() };

  let service: MessagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MessagesService(
      repo as never,
      logger as never,
      notifications as never,
      policy as never,
      sockets as never,
    );
  });

  it('does not persist a REST butcher-shop message when policy forbids', async () => {
    policy.assertCanSendMessage.mockRejectedValue(
      new ApiException(403, 'forbidden', 'التواصل المباشر مع الملحمة غير متاح'),
    );

    await expect(
      service.sendMessage(
        { userId: 'customer', username: 'c', role: 'USER' },
        {
          receiverId: 'butcher-user',
          text: 'hello shop',
          type: 'BUTCHER',
          butcherId: 'shop-1',
        },
      ),
    ).rejects.toMatchObject({ status: 403, error: 'forbidden' });

    expect(repo.createMessage).not.toHaveBeenCalled();
    expect(repo.upsertThread).not.toHaveBeenCalled();
  });

  it('does not persist a REST message when the policy rejects a block', async () => {
    policy.assertCanSendMessage.mockRejectedValue(
      new ApiException(403, 'blocked', 'لا يمكنك مراسلة هذا المستخدم'),
    );

    await expect(
      service.sendMessage(
        { userId: 'blocked', username: 'b', role: 'USER' },
        { receiverId: 'victim', text: 'hi' },
      ),
    ).rejects.toMatchObject({ status: 403, error: 'blocked' });

    expect(repo.createMessage).not.toHaveBeenCalled();
    expect(repo.upsertThread).not.toHaveBeenCalled();
  });

  it('emits chat:message after a successful REST send', async () => {
    policy.assertCanSendMessage.mockResolvedValue(undefined);
    repo.upsertThread.mockResolvedValue({ id: 't1' });
    repo.createMessage.mockResolvedValue({
      id: 'm1',
      senderId: 'alice',
      receiverId: 'bob',
      text: 'hi',
      sender: {
        arabicName: 'أ',
        displayName: 'A',
        avatar: null,
        username: 'alice',
      },
    });

    await service.sendMessage(
      { userId: 'alice', username: 'alice', role: 'USER' },
      { receiverId: 'bob', text: 'hi' },
    );

    expect(sockets.emitToThread).toHaveBeenCalledWith(
      't1',
      'chat:message',
      expect.objectContaining({ id: 'm1' }),
    );
    expect(sockets.emitToUser).toHaveBeenCalledWith(
      'bob',
      'chat:notification',
      expect.objectContaining({ threadId: 't1' }),
    );
  });

  it('does not convert an order-linked send into butcher chat', async () => {
    policy.assertCanSendMessage.mockRejectedValue(
      new ApiException(403, 'forbidden', 'التواصل المباشر مع الملحمة غير متاح'),
    );

    await expect(
      service.sendMessage(
        { userId: 'customer', username: 'c', role: 'USER' },
        {
          receiverId: 'butcher-user',
          text: 'from support ticket',
          orderId: 'ord-1',
        },
      ),
    ).rejects.toMatchObject({ status: 403, error: 'forbidden' });

    expect(repo.createMessage).not.toHaveBeenCalled();
    expect(repo.upsertThread).not.toHaveBeenCalled();
  });
});
