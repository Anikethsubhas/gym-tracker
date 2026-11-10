import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const token = (name: string) => `hsl(var(--${name}))`;

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Barlow', 'ui-sans-serif', 'system-ui', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['"Barlow Semi Condensed"', '"Arial Narrow"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
        destructive: { DEFAULT: token('destructive'), foreground: token('destructive-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        sidebar: {
          DEFAULT: token('sidebar'),
          foreground: token('sidebar-foreground'),
          accent: token('sidebar-accent'),
          muted: token('sidebar-muted'),
        },
        status: {
          paid: token('paid'),
          'paid-soft': token('paid-soft'),
          soon: token('soon'),
          'soon-soft': token('soon-soft'),
          late: token('late'),
          'late-soft': token('late-soft'),
          miss: token('miss'),
          'miss-soft': token('miss-soft'),
          idle: token('idle'),
          'idle-soft': token('idle-soft'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
