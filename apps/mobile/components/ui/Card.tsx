import { View } from 'react-native';
import type { ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <View
      className={`rounded-2xl bg-white p-4 shadow-sm ${className ?? ''}`}
      {...props}
    >
      {children}
    </View>
  );
}
