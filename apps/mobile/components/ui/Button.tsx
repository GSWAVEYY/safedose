import { Pressable, Text, type PressableProps } from 'react-native';
import { haptics } from '../../lib/haptics';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-brand-600 active:bg-brand-700',
    text: 'text-white font-semibold',
  },
  secondary: {
    container: 'bg-neutral-100 active:bg-neutral-200 border border-neutral-200',
    text: 'text-neutral-800 font-semibold',
  },
  danger: {
    container: 'bg-state-error active:opacity-80',
    text: 'text-white font-semibold',
  },
  ghost: {
    container: 'bg-transparent active:bg-neutral-100',
    text: 'text-brand-600 font-semibold',
  },
};

export function Button({
  label,
  variant = 'primary',
  disabled = false,
  onPress,
  ...rest
}: ButtonProps) {
  const styles = VARIANT_STYLES[variant];

  const handlePress: PressableProps['onPress'] = (event) => {
    if (variant === 'primary') {
      haptics.light();
    }
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      className={`rounded-2xl px-6 py-3.5 items-center justify-center ${styles.container} ${
        disabled ? 'opacity-50' : ''
      }`}
      style={{ minHeight: 48 }}
    >
      <Text className={`text-base ${styles.text}`}>{label}</Text>
    </Pressable>
  );
}
