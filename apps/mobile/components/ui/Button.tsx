import { Pressable, Text, type PressableProps } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-primary-600 active:bg-primary-700',
    text: 'text-white font-semibold',
  },
  secondary: {
    container: 'bg-slate-700 active:bg-slate-600 border border-slate-600',
    text: 'text-white font-semibold',
  },
  danger: {
    container: 'bg-danger-600 active:bg-danger-700',
    text: 'text-white font-semibold',
  },
};

export function Button({
  label,
  variant = 'primary',
  disabled = false,
  ...rest
}: ButtonProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      className={`rounded-xl px-6 py-3 items-center justify-center ${styles.container} ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <Text className={`text-base ${styles.text}`}>{label}</Text>
    </Pressable>
  );
}
