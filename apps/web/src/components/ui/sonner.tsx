import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="system"
    position="bottom-right"
    closeButton
    toastOptions={{
      classNames: {
        toast: 'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg font-sans',
        description: 'group-[.toast]:text-muted-foreground',
      },
    }}
    {...props}
  />
);

export { Toaster };
