import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      icons={{
        success: <span className="text-base">✅</span>,
        error: <span className="text-base">❌</span>,
        info: <span className="text-base">ℹ️</span>,
        warning: <span className="text-base">⚠️</span>,
        loading: <span className="text-base animate-spin">⏳</span>,
      }}
      toastOptions={{
        duration: 1800,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:!py-2 group-[.toaster]:!px-3 group-[.toaster]:!min-h-0",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:!static group-[.toast]:!ml-auto group-[.toast]:!mr-0 group-[.toast]:!mt-0 group-[.toast]:!mb-0 group-[.toast]:!transform-none group-[.toast]:!border-0 group-[.toast]:!bg-transparent group-[.toast]:!text-foreground group-[.toast]:!opacity-70 group-[.toast]:hover:!opacity-100 group-[.toast]:!h-5 group-[.toast]:!w-5 group-[.toast]:flex-shrink-0",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
