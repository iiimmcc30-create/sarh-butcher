// Powered by OnSpace.AI
// SAFAT — Messages (bottom tab)

import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { MessagesPanel } from '@/components/feature/MessagesPanel';
import { Screen, ScreenBody } from '@/design-system/layout';

export default function MessagesScreen() {
  return (
    <Screen edges={['top']}>
      <ScreenHeader variant="tab" title="الرسائل" />
      <ScreenBody scroll={false} gutter={false} bottomInset="tabBar">
        <MessagesPanel variant="standalone" showHeader={false} />
      </ScreenBody>
    </Screen>
  );
}
