import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './ui.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm' | 'icon' | 'iconSm'

const variantClass: Record<ButtonVariant, string | undefined> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
}

const sizeClass: Record<ButtonSize, string | undefined> = {
  md: undefined,
  sm: styles.sm,
  icon: styles.icon,
  iconSm: styles.iconSm,
}

export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
): string {
  return [styles.button, variantClass[variant], sizeClass[size]].filter(Boolean).join(' ')
}

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[buttonClass(variant, size), className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

interface LinkButtonProps extends Omit<ComponentPropsWithRef<typeof Link>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  children?: ReactNode
}

export function LinkButton({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={[buttonClass(variant, size), className].filter(Boolean).join(' ')} {...rest}>
      {icon}
      {children}
    </Link>
  )
}
