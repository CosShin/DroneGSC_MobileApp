import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type RootStackParamList = {
  Fly: undefined;
  Plan: undefined;
  Vehicle: undefined;
  Settings: undefined;
  Video: undefined;
};

export type MainRouteName = Exclude<keyof RootStackParamList, 'Video'>;

export const MAIN_NAV_ITEMS: ReadonlyArray<{
  name: MainRouteName;
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = [
  { name: 'Fly', label: 'Fly', icon: 'airplane' },
  { name: 'Plan', label: 'Plan', icon: 'map-marker-path' },
  { name: 'Vehicle', label: 'Vehicle', icon: 'quadcopter' },
  { name: 'Settings', label: 'Settings', icon: 'cog-outline' },
];
