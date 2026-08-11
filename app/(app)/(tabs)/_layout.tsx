import { Tabs } from 'expo-router';
import { BottomTabBar } from '@/components';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={props => <BottomTabBar {...props} />}>
      <Tabs.Screen name="grupos" />
      <Tabs.Screen name="carteira" />
      <Tabs.Screen name="ajustes" />
    </Tabs>
  );
}
