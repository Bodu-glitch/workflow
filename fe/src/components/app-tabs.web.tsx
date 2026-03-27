import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Pressable, useColorScheme, StyleSheet } from 'react-native';

import { ExternalLink } from './external-link';
import { Text, View } from '@/tw';
import { MaxContentWidth } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Explore</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        className={`px-4 py-1 rounded-2xl ${isFocused ? 'bg-[#E0E1E6] dark:bg-[#2E3135]' : 'bg-[#F0F0F3] dark:bg-[#212225]'}`}>
        <Text
          className={`text-sm font-medium ${isFocused ? 'text-black dark:text-white' : 'text-[#60646C] dark:text-[#B0B4BA]'}`}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const textColor = scheme === 'dark' ? '#ffffff' : '#000000';

  return (
    <View {...(props as object)} className="absolute w-full p-4 justify-center items-center flex-row">
      <View
        className="bg-[#F0F0F3] dark:bg-[#212225] py-2 px-8 rounded-[32px] flex-row items-center grow gap-2"
        style={{ maxWidth: MaxContentWidth }}>
        <Text className="text-sm font-bold mr-auto">Expo Starter</Text>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable className="flex-row justify-center items-center gap-1 ml-4">
            <Text className="text-sm leading-[30px]">Docs</Text>
            <SymbolView
              tintColor={textColor}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
});
